/**
 * @overview This code is a port of drizzle's "migrator":
 * https://github.com/drizzle-team/drizzle-orm/blob/83daf2d5cf023112de878bc2249ee2c41a2a5b1b/drizzle-orm/src/libsql/migrator.ts#L6
 *
 * Drizzle's verion relies on node's filesystem library (which is not available
 * to us in a WebView), so this code replaces that library with Tauri's `fs`
 * plugin. All other behavior is meant to be a fully compatible carbon copy.
 */

import { readTextFile } from '@tauri-apps/plugin-fs'
import { resolveResource } from '@tauri-apps/api/path'

import * as fs from '@tauri-apps/plugin-fs'
import type { SqliteRemoteDatabase, SqliteRemoteResult } from 'drizzle-orm/sqlite-proxy'
import { sql } from 'drizzle-orm/sql'
import type { MigrationMeta } from 'drizzle-orm/migrator'
import type { SQLiteRaw } from 'drizzle-orm/sqlite-core/query-builders/raw'

export async function migrate<TSchema extends Record<string, unknown>>(
  db: SqliteRemoteDatabase<TSchema>
) {
  const migrations = await readMigrationFiles()
  const migrationsTable = '__drizzle_migrations'

  const migrationTableCreate = sql`
    CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsTable)} (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    )
  `
  await db.run(migrationTableCreate)

  const dbMigrations = await db.values<[number, string, string]>(
    sql`SELECT id, hash, created_at FROM ${sql.identifier(migrationsTable)} ORDER BY created_at DESC LIMIT 1`
  )

  const lastDbMigration = dbMigrations[0] ?? undefined

  const statementToBatch: SQLiteRaw<SqliteRemoteResult<unknown>>[] = []

  for (const migration of migrations) {
    if (!lastDbMigration || Number(lastDbMigration[2]) < migration.folderMillis) {
      for (const stmt of migration.sql) {
        statementToBatch.push(db.run(sql.raw(stmt)))
      }

      statementToBatch.push(
        db.run(
          sql`INSERT INTO ${sql.identifier(
            migrationsTable
          )} ("hash", "created_at") VALUES(${migration.hash}, ${migration.folderMillis})`
        )
      )
    }
  }

  await runMigrations(db, statementToBatch)
}

async function runMigrations(
  db: SqliteRemoteDatabase<Record<string, unknown>>,
  statements: SQLiteRaw<SqliteRemoteResult<unknown>>[] | string[]
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.run('PRAGMA foreign_keys=OFF;')
    for (const statement of statements) {
      await tx.run(statement)
    }
    await tx.run('PRAGMA foreign_keys=ON;')
  })
}

async function readMigrationFiles(): Promise<MigrationMeta[]> {
  const migrationQueries: MigrationMeta[] = []

  const journalPath = await resolveResource('migrations/meta/_journal.json')
  if (!(await fs.exists(journalPath))) {
    throw new Error(`Can't find meta/_journal.json file`)
  }

  const journalAsString = await readTextFile(journalPath)

  const journal = JSON.parse(journalAsString) as {
    entries: { idx: number; when: number; tag: string; breakpoints: boolean }[]
  }

  for (const journalEntry of journal.entries) {
    const migrationPath = await resolveResource(`migrations/${journalEntry.tag}.sql`)

    try {
      const query = await readTextFile(migrationPath)

      const result = query.split('--> statement-breakpoint').map((it) => {
        return it
      })

      migrationQueries.push({
        sql: result,
        bps: journalEntry.breakpoints,
        folderMillis: journalEntry.when,
        hash: await hashMessage(query),
      })
    } catch {
      throw new Error(`No file ${migrationPath} found in migrations folder`)
    }
  }

  return migrationQueries
}

/**
 * Re-implements node:crypto's
 * `crypto.createHash('sha256').update(message).digest('hex'), but using web APIs.
 */
async function hashMessage(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message) // encode as (utf-8) Uint8Array
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8) // hash the message
  const hashArray = Array.from(new Uint8Array(hashBuffer)) // convert buffer to byte array
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('') // convert bytes to hex string
  return hashHex
}

/**
 * @overview This code is a port of drizzle's "migrator":
 * https://github.com/drizzle-team/drizzle-orm/blob/83daf2d5cf023112de878bc2249ee2c41a2a5b1b/drizzle-orm/src/libsql/migrator.ts#L6
 *
 * Drizzle's verion relies on node's filesystem library (which is not available
 * to us in a WebView), so this code replaces that library with Tauri's `fs`
 * plugin.
 *
 * Our implementation also extends functionality: the original code _only_
 * checks the **last** migration applied, and only applies _newer_ timestamps.
 * The new implementation applies _all_ migrations that have not yet been
 * applied; even if they are older. This allows two independent developers to
 * commit independent migrations and get cross-applied on each others' machines
 * without a race condition.
 */

import { readTextFile } from '@tauri-apps/plugin-fs'
import { resolveResource } from '@tauri-apps/api/path'

import * as fs from '@tauri-apps/plugin-fs'
import { SqliteRemoteDatabase, type SqliteRemoteResult } from 'drizzle-orm/sqlite-proxy'
import { sql } from 'drizzle-orm/sql'
import type { MigrationMeta as DrizzleMigrationMeta } from 'drizzle-orm/migrator'
import type { SQLiteRaw } from 'drizzle-orm/sqlite-core/query-builders/raw'

const MIGRATIONS_TABLE = '__drizzle_migrations'

type MigrationRecord = {
  id: number
  hash: string
  created_at: string
}

type MigrationRecordMap = Record<string, MigrationRecord> // { created_at: migration_record }

type MigrationMeta = DrizzleMigrationMeta & {
  tag: string
}

type DbType = SqliteRemoteDatabase<Record<string, unknown>>

export async function migrate(db: DbType) {
  await initMigrationTable(db)
  const appliedMigrations = await getAppliedMigrations(db)
  const allMigrations = await readMigrationFiles()

  const pendingMigrations = getPendingMigrations(allMigrations, appliedMigrations)

  await runMigrationBatch(db, generateMigrationBatch(db, pendingMigrations))
}

async function initMigrationTable(db: DbType) {
  const migrationTableCreate = sql`
    CREATE TABLE IF NOT EXISTS ${sql.identifier(MIGRATIONS_TABLE)} (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    )
  `
  return await db.run(migrationTableCreate)
}

async function getAppliedMigrations(db: DbType): Promise<MigrationRecordMap> {
  return (
    await db.values<[number, string, string]>(
      sql`SELECT id, hash, created_at FROM ${sql.identifier(MIGRATIONS_TABLE)}`
    )
  )
    .map(([id, hash, created_at]) => ({ id, hash, created_at }))
    .reduce<Record<string, MigrationRecord>>((resMap, record) => {
      resMap[record.created_at] = record
      return resMap
    }, {})
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
        tag: journalEntry.tag,
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

function getPendingMigrations(
  migrations: MigrationMeta[],
  existingMigrations: MigrationRecordMap
): MigrationMeta[] {
  return migrations.filter((migration) => {
    const timestamp = migration.folderMillis
    const existing = existingMigrations[timestamp]
    if (existing && existing.hash !== migration.hash) {
      // TODO(rkofman): not sure if this is the right approach in prod when encountering inconsistent state.
      throw new Error(
        `Migration hash mismatch for ${migration.tag}. Bailing on migrations due to inconsistent DB state.`
      )
    }
    return !existing
  })
}

function generateMigrationBatch(
  db: DbType,
  migrations: MigrationMeta[]
): SQLiteRaw<SqliteRemoteResult>[] {
  const statementToBatch: SQLiteRaw<SqliteRemoteResult<unknown>>[] = []
  for (const migration of migrations) {
    for (const stmt of migration.sql) {
      statementToBatch.push(db.run(sql.raw(stmt)))
    }

    statementToBatch.push(
      db.run(
        sql`INSERT INTO ${sql.identifier(
          MIGRATIONS_TABLE
        )} ("hash", "created_at") VALUES(${migration.hash}, ${migration.folderMillis})`
      )
    )
  }
  return statementToBatch
}
async function runMigrationBatch(
  db: DbType,
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

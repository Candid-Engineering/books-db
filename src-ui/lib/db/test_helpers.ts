import * as schema from '$lib/db/schema'
import initSqlJs, { type Database } from 'sql.js'
import { drizzle, SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'
import { migrate } from './migrator'
import * as fs from 'node:fs'
import * as path from 'node:path'

const sqlite3 = await initSqlJs()
export async function createTestDB(): Promise<{
  drizzle: SqliteRemoteDatabase<typeof schema>
  sqlite: Database
}> {
  const db = new sqlite3.Database()

  const drizzleDb = drizzle(
    async (sql, params, method): Promise<{ rows: unknown[] }> => {
      let rows: initSqlJs.SqlValue[][] = []
      try {
        if (method === 'run') {
          db.run(sql, params)
        } else {
          rows = db.exec(sql, params)[0]?.values || []
        }
      } catch (e: unknown) {
        console.error('Error from sqlite TEST proxy server: ', e)
      }
      return Promise.resolve({ rows: rows })
    },
    { schema }
  )
  await migrate(drizzleDb, getJournal(), await readMigrationFiles())

  return { drizzle: drizzleDb, sqlite: db }
}

async function readMigrationFiles(): Promise<Record<string, string>> {
  const dirEntries = fs.readdirSync('migrations/', {
    withFileTypes: true,
  })
  const migrationFileEntries = dirEntries
    .filter((dirEntry) => dirEntry.isFile())
    .map((dirEntry) => {
      const fullPath = path.join(dirEntry.parentPath, dirEntry.name)
      const fileContent = fs.readFileSync(fullPath).toString()
      // TODO(rkofman): might be a better way to drop the `.sql` part of the filename
      const baseFileName = dirEntry.name.split('.')[0]
      return [baseFileName, fileContent]
    })
  return Object.fromEntries(migrationFileEntries)
}

const getJournal = () => {
  const journalPath = 'migrations/meta/_journal.json'
  return fs.readFileSync(journalPath).toString()
}

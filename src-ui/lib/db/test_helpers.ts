import * as schema from '$lib/db/schema'
import initSqlJs, { type Database } from 'sql.js'
import { drizzle, SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'

const sqlite3 = await initSqlJs()
export function createTestDB(): {
  drizzle: SqliteRemoteDatabase<typeof schema>
  sqlite: Database
} {
  const db = new sqlite3.Database()

  // NOTE: this sql schema is a hack to unblock testing in the short term. Longer term,
  // this should be replaced by a schema.sql that is exported from the dev DB
  // whenever a migration is completed -- or by running the migrations themselves.
  const sqlSchema = `CREATE TABLE books (
      id TEXT PRIMARY KEY default(uuid_blob(uuid())) NOT NULL,
      isbn10 TEXT,
      isbn13 TEXT,
      title TEXT NOT NULL,
      subtitle TEXT,
      authors TEXT NOT NULL,
      tags TEXT,
      series TEXT,
      pageCount INTEGER,
      publicationDate TEXT,
      copyrightDate TEXT,
      coverImages TEXT,
      hasRead INTEGER,
      createdAt INTEGER DEFAULT(unixepoch()) NOT NULL
    );`
  db.exec(sqlSchema)

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

  return { drizzle: drizzleDb, sqlite: db }
}

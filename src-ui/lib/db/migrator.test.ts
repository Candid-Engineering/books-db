import { describe, it, expect } from 'vitest'
import initSqlJs from 'sql.js'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { migrate } from './migrator'

// SQLite rejects `ALTER TABLE ... ADD COLUMN ... DEFAULT (someFunction())`
// against a table that already has rows ("Cannot add a column with
// non-constant default") - but createTestDB() (used by every other test in
// this repo) always starts from an empty database and runs every migration
// from genesis, so that table is never populated when the ADD COLUMN runs.
// That's a real blind spot: it let exactly this mistake ship undetected,
// only surfacing against a real, already-in-use local database. These tests
// exercise the migrator against a table that already has rows, matching
// what a real upgrade actually looks like.
describe('migrate against an already-populated table', () => {
  async function createDb() {
    const sqlite3 = await initSqlJs()
    const sqlite = new sqlite3.Database()
    const drizzleDb = drizzle((sql, params, method): Promise<{ rows: unknown[] }> => {
      let rows: unknown[][] = []
      if (method === 'run') {
        sqlite.run(sql, params)
      } else {
        rows = sqlite.exec(sql, params)[0]?.values || []
      }
      return Promise.resolve({ rows })
    })
    return { drizzleDb, sqlite }
  }

  const firstJournalEntries = [ { idx: 0, when: 1, tag: '0001_create_books', breakpoints: true } ]
  const firstJournal = JSON.stringify({ entries: firstJournalEntries })
  const firstMigrationData = {
    '0001_create_books': 'CREATE TABLE books (id text PRIMARY KEY, title text NOT NULL);',
  }

  it('rejects a naive ADD COLUMN with a non-constant default (documents the constraint)', async () => {
    const { drizzleDb, sqlite } = await createDb()
    await migrate(drizzleDb, firstJournal, firstMigrationData)
    sqlite.run("INSERT INTO books (id, title) VALUES ('1', 'Dune')")

    const journal = JSON.stringify({
      entries: [
        ...firstJournalEntries,
        { idx: 1, when: 2, tag: '0002_naive_add_updated_at', breakpoints: true },
      ],
    })
    const migrationData = {
      ...firstMigrationData,
      '0002_naive_add_updated_at': 'ALTER TABLE books ADD updatedAt integer DEFAULT (unixepoch());',
    }

    await expect(migrate(drizzleDb, journal, migrationData)).rejects.toThrow()
  })

  it('succeeds with the safe pattern: add nullable, then backfill via UPDATE', async () => {
    const { drizzleDb, sqlite } = await createDb()
    await migrate(drizzleDb, firstJournal, firstMigrationData)
    sqlite.run("INSERT INTO books (id, title) VALUES ('1', 'Dune')")

    const journal = JSON.stringify({
      entries: [
        ...firstJournalEntries,
        { idx: 1, when: 2, tag: '0002_safe_add_updated_at', breakpoints: true },
      ],
    })
    const migrationData = {
      ...firstMigrationData,
      '0002_safe_add_updated_at':
        'ALTER TABLE books ADD updatedAt integer;--> statement-breakpoint\n' +
        'UPDATE books SET updatedAt = unixepoch() WHERE updatedAt IS NULL;',
    }

    await migrate(drizzleDb, journal, migrationData)

    const [ [ updatedAt ] ] = sqlite.exec('SELECT updatedAt FROM books')[0].values
    expect(updatedAt).toBeGreaterThan(0)
  })
})

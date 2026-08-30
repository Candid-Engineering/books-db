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

  const firstJournalEntries = [{ idx: 0, when: 1, tag: '0001_create_books', breakpoints: true }]
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

    const [[updatedAt]] = sqlite.exec('SELECT updatedAt FROM books')[0].values
    expect(updatedAt).toBeGreaterThan(0)
  })

  it('backfills book_authors from the legacy authors JSON column before dropping it', async () => {
    const { drizzleDb, sqlite } = await createDb()
    const journalWithAuthorsColumn = JSON.stringify({
      entries: [
        {
          idx: 0,
          when: 1,
          tag: '0001_create_books_with_authors_json',
          breakpoints: true,
        },
      ],
    })
    const migrationDataWithAuthorsColumn = {
      '0001_create_books_with_authors_json':
        "CREATE TABLE books (id text PRIMARY KEY, title text NOT NULL, authors text NOT NULL DEFAULT '[]');",
    }
    await migrate(drizzleDb, journalWithAuthorsColumn, migrationDataWithAuthorsColumn)
    sqlite.run(
      "INSERT INTO books (id, title, authors) VALUES ('1', 'Dune', '[\"Frank Herbert\"]'), ('2', 'No Author', '[]')"
    )

    const journal = JSON.stringify({
      entries: [
        ...(JSON.parse(journalWithAuthorsColumn) as { entries: unknown[] }).entries,
        { idx: 1, when: 2, tag: '0002_add_book_authors_table', breakpoints: true },
      ],
    })
    const migrationData = {
      ...migrationDataWithAuthorsColumn,
      '0002_add_book_authors_table':
        'CREATE TABLE book_authors (bookId text NOT NULL, name text NOT NULL, PRIMARY KEY (bookId, name));' +
        '--> statement-breakpoint\n' +
        "INSERT INTO book_authors (bookId, name) SELECT books.id, json_each.value FROM books, json_each(books.authors) WHERE json_each.value != '';" +
        '--> statement-breakpoint\n' +
        'ALTER TABLE books DROP COLUMN authors;',
    }

    await migrate(drizzleDb, journal, migrationData)

    const authorRows = sqlite.exec('SELECT bookId, name FROM book_authors')[0]?.values ?? []
    expect(authorRows).toEqual([['1', 'Frank Herbert']])
    expect(sqlite.exec('PRAGMA table_info(books)')[0].values.map((row) => row[1])).not.toContain(
      'authors'
    )
  })

  it('backfills book_series verbatim from the legacy series column before dropping it', async () => {
    const { drizzleDb, sqlite } = await createDb()
    const journalWithSeriesColumn = JSON.stringify({
      entries: [{ idx: 0, when: 1, tag: '0001_create_books_with_series', breakpoints: true }],
    })
    const migrationDataWithSeriesColumn = {
      '0001_create_books_with_series':
        'CREATE TABLE books (id text PRIMARY KEY, title text NOT NULL, series text);',
    }
    await migrate(drizzleDb, journalWithSeriesColumn, migrationDataWithSeriesColumn)
    sqlite.run(
      "INSERT INTO books (id, title, series) VALUES ('1', 'Dune Messiah', 'Dune (2)'), ('2', 'Standalone', NULL), ('3', 'Empty', '')"
    )

    const journal = JSON.stringify({
      entries: [
        ...(JSON.parse(journalWithSeriesColumn) as { entries: unknown[] }).entries,
        { idx: 1, when: 2, tag: '0002_add_book_series_table', breakpoints: true },
      ],
    })
    const migrationData = {
      ...migrationDataWithSeriesColumn,
      '0002_add_book_series_table':
        'CREATE TABLE book_series (bookId text NOT NULL, name text NOT NULL, label text, sortKey real, PRIMARY KEY (bookId, name));' +
        '--> statement-breakpoint\n' +
        "INSERT INTO book_series (bookId, name) SELECT id, series FROM books WHERE series IS NOT NULL AND series != '';" +
        '--> statement-breakpoint\n' +
        'ALTER TABLE books DROP COLUMN series;',
    }

    await migrate(drizzleDb, journal, migrationData)

    const seriesRows =
      sqlite.exec('SELECT bookId, name, label, sortKey FROM book_series')[0]?.values ?? []
    expect(seriesRows).toEqual([['1', 'Dune (2)', null, null]])
    expect(sqlite.exec('PRAGMA table_info(books)')[0].values.map((row) => row[1])).not.toContain(
      'series'
    )
  })
})

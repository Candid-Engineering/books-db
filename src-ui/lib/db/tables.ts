import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core'

export const books = sqliteTable('books', {
  id: text().default('sql`(uuid_blob(uuid()))`').primaryKey().notNull(),
  isbn10: text(),
  isbn13: text(),
  title: text().notNull(),
  subtitle: text(),
  series: text(),
  pageCount: integer(),
  publicationDate: text(),
  copyrightDate: text(),
  coverImages: text({ mode: 'json' }).$type<{ small?: string; medium?: string; large?: string }>(),
  readAt: integer({ mode: 'timestamp' }),
  createdAt: integer({ mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  // Nullable, no DB default (unlike createdAt): SQLite rejects ALTER TABLE
  // ADD COLUMN with a non-constant default against a table that already has
  // rows, which this column's migration must do for any real, already-used
  // database. The app sets it explicitly on every write instead.
  updatedAt: integer({ mode: 'timestamp' }),
  deletedAt: integer({ mode: 'timestamp' }), // tombstone; null = active
  syncedAt: integer({ mode: 'timestamp' }), // null = pending push to server
})

export const bookTags = sqliteTable(
  'book_tags',
  {
    bookId: text()
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }), // automatically deletes tags when a book is deleted
    name: text().notNull(),
    // See books.updatedAt for why this has no DB default.
    updatedAt: integer({ mode: 'timestamp' }),
    deletedAt: integer({ mode: 'timestamp' }), // tombstone; null = active
    syncedAt: integer({ mode: 'timestamp' }), // null = pending push to server
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.bookId, table.name] }),
    }
  }
)

export const bookAuthors = sqliteTable(
  'book_authors',
  {
    bookId: text()
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }), // automatically deletes authors when a book is deleted
    name: text().notNull(),
    // See books.updatedAt for why this has no DB default.
    updatedAt: integer({ mode: 'timestamp' }),
    deletedAt: integer({ mode: 'timestamp' }), // tombstone; null = active
    syncedAt: integer({ mode: 'timestamp' }), // null = pending push to server
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.bookId, table.name] }),
    }
  }
)

export const localUser = sqliteTable('local_user', {
  singleton: integer().primaryKey().default(1), // fixed PK — enforces at most one row
  id: text().notNull(),
  email: text().notNull(),
  name: text().notNull(),
  updatedAt: integer({ mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const syncState = sqliteTable('sync_state', {
  singleton: integer().primaryKey().default(1), // fixed PK — enforces at most one row
  booksSince: integer().notNull().default(0),
  bookTagsSince: integer().notNull().default(0),
  bookAuthorsSince: integer().notNull().default(0),
})

// Dev-only backing store for SqliteTokenStorage (see token-storage.ts) - an
// unencrypted alternative to the OS keychain, used only when running via
// `pnpm tauri dev`, to avoid keychain access-control prompts on unsigned,
// frequently-rebuilt dev binaries. Never used in a real build.
export const devTokens = sqliteTable('dev_tokens', {
  namespace: text().primaryKey(),
  value: text().notNull(),
})

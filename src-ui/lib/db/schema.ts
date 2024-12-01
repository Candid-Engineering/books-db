import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const books = sqliteTable('books', {
  id: text().default('sql`(uuid_blob(uuid()))`').primaryKey().notNull(),
  isbn10: text(),
  isbn13: text(),
  title: text().notNull(),
  subtitle: text(),
  authors: text({ mode: 'json' }).notNull().$type<string[]>(),
  tags: text({ mode: 'json' }).$type<string[]>(),
  series: text(),
  pageCount: integer(),
  publicationDate: text(),
  copyrightDate: text(),
  coverImages: text({ mode: 'json' }).$type<{ small?: string; medium?: string; large?: string }>(),
  readAt: integer({mode: 'timestamp'}),
  createdAt: integer({ mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

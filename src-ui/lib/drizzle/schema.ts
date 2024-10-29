import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const books = sqliteTable('books', {
  id: text().default('sql`(uuid_blob(uuid()))`').primaryKey().notNull(),
  isbn10: text(),
  isbn13: text(),
  title: text().notNull(),
  subtitle: text(),
  // authors: text().notNull(), // NOTE: manually keep the line below after schema pull overrides it.
  authors: text({ mode: 'json' }).notNull().$type<string[]>(),
  // tags: text(),
  tags: text({ mode: 'json' }).$type<string[]>(),
  series: text(),
  pageCount: integer(),
  publicationDate: text(),
  copyrightDate: text(),
  // coverImages: text(), // NOTE: manually keep the line below after schema pull overrides it.
  coverImages: text({ mode: 'json' }).$type<{ small?: string; medium?: string; large?: string }>(),
  // hasRead: integer(), // NOTE: manually keep the line below after schema pull overrides it.
  hasRead: integer({ mode: 'boolean' }),
})

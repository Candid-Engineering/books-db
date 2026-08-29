import * as schema from '$lib/db/schema'

export type BookTag = typeof schema.bookTags.$inferSelect
export type BookAuthor = typeof schema.bookAuthors.$inferSelect
export type BookSeries = typeof schema.bookSeries.$inferSelect
export type Book = typeof schema.books.$inferSelect & {
  tags: BookTag[]
  authors: BookAuthor[]
  series: BookSeries[]
}
export type NewBook = typeof schema.books.$inferInsert

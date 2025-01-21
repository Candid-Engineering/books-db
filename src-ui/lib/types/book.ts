import * as schema from '$lib/db/schema'

export type BookTag = typeof schema.bookTags.$inferSelect
export type BookAuthor = typeof schema.bookAuthors.$inferSelect
export type Book = typeof schema.books.$inferSelect & { tags: BookTag[]; authors: BookAuthor[] }
export type NewBook = typeof schema.books.$inferInsert

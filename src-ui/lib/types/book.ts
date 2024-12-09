import * as schema from '$lib/db/schema'

export type BookTag = typeof schema.bookTags.$inferSelect
export type Book = typeof schema.books.$inferSelect & {tags: BookTag[]}
export type NewBook = typeof schema.books.$inferInsert

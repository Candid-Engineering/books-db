import * as schema from '$lib/db/schema'

export type Book = typeof schema.books.$inferSelect
export type NewBook = typeof schema.books.$inferInsert

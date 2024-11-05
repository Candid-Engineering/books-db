import * as schema from '$lib/drizzle/schema'

export type Book = typeof schema.books.$inferSelect
export type NewBook = typeof schema.books.$inferInsert

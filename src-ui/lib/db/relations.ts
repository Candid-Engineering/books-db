import { relations } from 'drizzle-orm'
import { books, bookAuthors, bookTags } from './tables'

export const booksRelations = relations(books, ({ many }) => ({
  tags: many(bookTags),
  authors: many(bookAuthors),
}))

export const bookTagsRelations = relations(bookTags, ({ one }) => ({
  book: one(books, {
    fields: [bookTags.bookId],
    references: [books.id],
  }),
}))

export const bookAuthorsRelations = relations(bookAuthors, ({ one }) => ({
  book: one(books, {
    fields: [bookAuthors.bookId],
    references: [books.id],
  }),
}))

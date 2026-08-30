import { relations } from 'drizzle-orm'
import { books, bookAuthors, bookSeries, bookTags } from './tables'

export const booksRelations = relations(books, ({ many }) => ({
  tags: many(bookTags),
  authors: many(bookAuthors),
  series: many(bookSeries),
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

export const bookSeriesRelations = relations(bookSeries, ({ one }) => ({
  book: one(books, {
    fields: [bookSeries.bookId],
    references: [books.id],
  }),
}))

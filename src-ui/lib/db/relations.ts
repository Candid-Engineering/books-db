import { relations } from 'drizzle-orm';
import { books, bookTags } from './schema'


export const booksRelations = relations(books, ({ many }) => ({
	tags: many(bookTags),
}));

export const bookTagsRelations = relations(bookTags, ({ one }) => ({
	book: one(books, {
		fields: [bookTags.bookId],
		references: [books.id],
	}),
}));

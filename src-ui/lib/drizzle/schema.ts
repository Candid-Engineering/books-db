import { sqliteTable, AnySQLiteColumn, text, integer } from "drizzle-orm/sqlite-core"
  import { sql } from "drizzle-orm"

export const books = sqliteTable("books", {
	id: text().default("sql`(uuid_blob(uuid()))`").primaryKey().notNull(),
	isbn10: text(),
	isbn13: text(),
	title: text().notNull(),
	subtitle: text(),
	authors: text().notNull(),
	tags: text(),
	series: text(),
	pageCount: integer(),
	publicationDate: text(),
	copyrightDate: text(),
	coverImages: text(),
	hasRead: integer(),
});


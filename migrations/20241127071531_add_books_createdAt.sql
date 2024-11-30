-- Complex workaround for: ALTER TABLE `books` ADD `createdAt` integer DEFAULT (unixepoch()) NOT NULL;
-- which fails with: `Cannot add a column with non-constant default`
CREATE TABLE `TEMP_NEW_books` (
	`id` text PRIMARY KEY DEFAULT 'sql`(uuid_blob(uuid()))`' NOT NULL,
	`isbn10` text,
	`isbn13` text,
	`title` text NOT NULL,
	`subtitle` text,
	`authors` text NOT NULL,
	`tags` text,
	`series` text,
	`pageCount` integer,
	`publicationDate` text,
	`copyrightDate` text,
	`coverImages` text,
	`hasRead` integer,
  `createdAt` integer DEFAULT (unixepoch()) NOT NULL
); --> statement-breakpoint
INSERT INTO TEMP_NEW_books SELECT *, unixepoch() FROM books; --> statement-breakpoint

DROP TABLE books; --> statement-breakpoint
ALTER TABLE TEMP_NEW_books
  RENAME TO books;

CREATE TABLE `books` (
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
	`hasRead` integer
);

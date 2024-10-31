-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `books` (
	`id` text PRIMARY KEY DEFAULT (uuid_blob(uuid())) NOT NULL,
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

*/
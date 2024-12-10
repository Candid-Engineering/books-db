CREATE TABLE `book_tags` (
	`bookId` text NOT NULL,
	`name` text NOT NULL,
	PRIMARY KEY(`bookId`, `name`),
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `books` DROP COLUMN `tags`;
CREATE TABLE `book_authors` (
	`bookId` text NOT NULL,
	`name` text NOT NULL,
	`updatedAt` integer,
	`deletedAt` integer,
	`syncedAt` integer,
	PRIMARY KEY(`bookId`, `name`),
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `sync_state` ADD `bookAuthorsSince` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
INSERT INTO `book_authors` (`bookId`, `name`) SELECT `books`.`id`, `json_each`.`value` FROM `books`, `json_each`(`books`.`authors`) WHERE `json_each`.`value` != '';--> statement-breakpoint
ALTER TABLE `books` DROP COLUMN `authors`;
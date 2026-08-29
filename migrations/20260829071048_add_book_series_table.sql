CREATE TABLE `book_series` (
	`bookId` text NOT NULL,
	`name` text NOT NULL,
	`label` text,
	`sortKey` real,
	`updatedAt` integer,
	`deletedAt` integer,
	`syncedAt` integer,
	PRIMARY KEY(`bookId`, `name`),
	FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `sync_state` ADD `bookSeriesSince` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
INSERT INTO `book_series` (`bookId`, `name`) SELECT `books`.`id`, `books`.`series` FROM `books` WHERE `books`.`series` IS NOT NULL AND `books`.`series` != '';--> statement-breakpoint
ALTER TABLE `books` DROP COLUMN `series`;
CREATE TABLE `sync_state` (
	`singleton` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`booksSince` integer DEFAULT 0 NOT NULL,
	`bookTagsSince` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `book_tags` ADD `updatedAt` integer;--> statement-breakpoint
ALTER TABLE `book_tags` ADD `deletedAt` integer;--> statement-breakpoint
ALTER TABLE `book_tags` ADD `syncedAt` integer;--> statement-breakpoint
ALTER TABLE `books` ADD `updatedAt` integer;--> statement-breakpoint
ALTER TABLE `books` ADD `deletedAt` integer;--> statement-breakpoint
ALTER TABLE `books` ADD `syncedAt` integer;--> statement-breakpoint
UPDATE `book_tags` SET `updatedAt` = unixepoch() WHERE `updatedAt` IS NULL;--> statement-breakpoint
UPDATE `books` SET `updatedAt` = unixepoch() WHERE `updatedAt` IS NULL;
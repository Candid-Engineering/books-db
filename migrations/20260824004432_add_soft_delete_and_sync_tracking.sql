ALTER TABLE `book_tags` ADD `updatedAt` integer DEFAULT (unixepoch()) NOT NULL;--> statement-breakpoint
ALTER TABLE `book_tags` ADD `deletedAt` integer;--> statement-breakpoint
ALTER TABLE `book_tags` ADD `syncedAt` integer;--> statement-breakpoint
ALTER TABLE `books` ADD `updatedAt` integer DEFAULT (unixepoch()) NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `deletedAt` integer;--> statement-breakpoint
ALTER TABLE `books` ADD `syncedAt` integer;
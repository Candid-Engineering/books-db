ALTER TABLE `book_authors` ADD `position` real;--> statement-breakpoint
ALTER TABLE `book_series` ADD `position` real;--> statement-breakpoint
ALTER TABLE `book_tags` ADD `position` real;--> statement-breakpoint
-- Backfill existing rows to today's alphabetical order (position = 0-indexed
-- rank of `name` among a book's rows). The server runs the identical backfill,
-- so the two sides agree without a sync round-trip. Original entry order is
-- unrecoverable.
UPDATE `book_authors` SET `position` = (
  SELECT COUNT(*) FROM `book_authors` AS x
  WHERE x.`book_id` = `book_authors`.`book_id` AND x.`name` < `book_authors`.`name`
);--> statement-breakpoint
UPDATE `book_series` SET `position` = (
  SELECT COUNT(*) FROM `book_series` AS x
  WHERE x.`book_id` = `book_series`.`book_id` AND x.`name` < `book_series`.`name`
);--> statement-breakpoint
UPDATE `book_tags` SET `position` = (
  SELECT COUNT(*) FROM `book_tags` AS x
  WHERE x.`book_id` = `book_tags`.`book_id` AND x.`name` < `book_tags`.`name`
);

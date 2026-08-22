CREATE TABLE `local_user` (
	`singleton` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);

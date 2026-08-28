CREATE TABLE `sync_state` (
	`singleton` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`booksSince` integer DEFAULT 0 NOT NULL,
	`bookTagsSince` integer DEFAULT 0 NOT NULL
);

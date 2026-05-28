CREATE TABLE `event` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`parent_id` text,
	`seq` integer,
	`event_type` text NOT NULL,
	`created_at` integer NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_event_session_id` ON `event` (`session_id`);--> statement-breakpoint
CREATE TABLE `project` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`parent_session_id` text,
	`title` text,
	`directory` text NOT NULL,
	`agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_session_project_id` ON `session` (`project_id`);--> statement-breakpoint
CREATE TABLE `session_event` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`event_type` text NOT NULL,
	`created_at` integer NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_session_event_session_id` ON `session_event` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_session_event_event_type` ON `session_event` (`event_type`);
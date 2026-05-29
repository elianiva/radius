CREATE TABLE `session_summary` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`duration` integer NOT NULL,
	`message_count` integer NOT NULL,
	`user_msg_count` integer NOT NULL,
	`asst_msg_count` integer NOT NULL,
	`tool_call_count` integer NOT NULL,
	`tool_error_count` integer NOT NULL,
	`total_tokens` integer NOT NULL,
	`total_cost` real NOT NULL,
	`models` text NOT NULL,
	`stop_reasons` text NOT NULL,
	CONSTRAINT `fk_session_summary_id_session_id_fk` FOREIGN KEY (`id`) REFERENCES `session`(`id`)
);
--> statement-breakpoint
CREATE TABLE `swear_entry` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`session_id` text NOT NULL,
	`project_name` text NOT NULL,
	`session_title` text,
	`word` text NOT NULL,
	`context` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_swear_entry_session_id_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_swear_entry_session_id` ON `swear_entry` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_swear_entry_word` ON `swear_entry` (`word`);--> statement-breakpoint
CREATE INDEX `idx_swear_entry_project` ON `swear_entry` (`project_name`);
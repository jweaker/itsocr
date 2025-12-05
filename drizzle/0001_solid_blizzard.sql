CREATE TABLE `scanned_image` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`file_name` text NOT NULL,
	`original_url` text NOT NULL,
	`thumbnail_url` text,
	`mime_type` text NOT NULL,
	`file_size_bytes` integer NOT NULL,
	`width` integer,
	`height` integer,
	`extracted_text` text,
	`confidence` real,
	`language` text,
	`processing_time_ms` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scanned_image_user_idx` ON `scanned_image` (`user_id`);--> statement-breakpoint
CREATE INDEX `scanned_image_created_idx` ON `scanned_image` (`created_at`);--> statement-breakpoint
CREATE INDEX `scanned_image_status_idx` ON `scanned_image` (`status`);--> statement-breakpoint
CREATE TABLE `usage_record` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`images_scanned` integer DEFAULT 0 NOT NULL,
	`bytes_processed` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `usage_record_user_idx` ON `usage_record` (`user_id`);--> statement-breakpoint
CREATE INDEX `usage_record_period_idx` ON `usage_record` (`period_start`,`period_end`);--> statement-breakpoint
ALTER TABLE `user` ADD `plan_id` text DEFAULT 'free' NOT NULL;
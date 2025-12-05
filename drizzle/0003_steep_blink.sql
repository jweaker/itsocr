CREATE UNIQUE INDEX `scanned_image_key_idx` ON `scanned_image` (`image_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `usage_record_user_period_idx` ON `usage_record` (`user_id`,`period_start`);
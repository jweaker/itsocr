ALTER TABLE `scanned_image` ADD `content_hash` text;--> statement-breakpoint
CREATE INDEX `scanned_image_hash_idx` ON `scanned_image` (`user_id`,`content_hash`);
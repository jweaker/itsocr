ALTER TABLE `scanned_image` ADD `is_pdf` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `scanned_image` ADD `page_count` integer;--> statement-breakpoint
ALTER TABLE `scanned_image` ADD `page_images` text;
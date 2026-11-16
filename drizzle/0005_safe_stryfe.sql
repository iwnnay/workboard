CREATE TABLE `full_review_file` (
	`project_id` text NOT NULL,
	`path` text NOT NULL,
	`baseline_fingerprint` text,
	`current_fingerprint` text,
	`byte_size` integer DEFAULT 0 NOT NULL,
	`modified_at` text,
	`checked` integer DEFAULT false NOT NULL,
	`checked_at` text,
	`changed_at` text,
	`first_seen_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `path`)
);
--> statement-breakpoint
CREATE TABLE `full_review_scope` (
	`project_id` text NOT NULL,
	`path` text NOT NULL,
	`last_polled_at` text,
	`created_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `path`)
);

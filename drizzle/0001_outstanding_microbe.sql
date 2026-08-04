CREATE TABLE `managed_server` (
	`id` text PRIMARY KEY NOT NULL,
	`alias` text NOT NULL,
	`directory` text NOT NULL,
	`server_type` text NOT NULL,
	`port` integer,
	`docker` integer DEFAULT false NOT NULL,
	`docker_command` text DEFAULT '' NOT NULL,
	`pid` integer,
	`started_at` text,
	`log_path` text,
	`created_at` text NOT NULL
);

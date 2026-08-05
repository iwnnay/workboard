PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_managed_server` (
	`id` text PRIMARY KEY NOT NULL,
	`alias` text NOT NULL,
	`directory` text NOT NULL,
	`server_type` text NOT NULL,
	`port` integer NOT NULL,
	`docker` integer DEFAULT false NOT NULL,
	`docker_command` text DEFAULT '' NOT NULL,
	`pid` integer,
	`started_at` text,
	`log_path` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_managed_server`("id", "alias", "directory", "server_type", "port", "docker", "docker_command", "pid", "started_at", "log_path", "created_at") SELECT "id", "alias", "directory", "server_type", "port", "docker", "docker_command", "pid", "started_at", "log_path", "created_at" FROM `managed_server`;--> statement-breakpoint
DROP TABLE `managed_server`;--> statement-breakpoint
ALTER TABLE `__new_managed_server` RENAME TO `managed_server`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
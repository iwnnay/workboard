export type Todo = {
	id: string;
	text: string;
	completed: boolean;
	completedAt: string | null;
	createdAt: string;
};

export type Note = {
	id: string;
	title: string;
	content: string;
	createdAt: string;
	updatedAt: string;
};

export type Project = {
	id: string;
	name: string;
	path: string;
	createdAt: string;
};

export type BookmarkFolder = {
	id: string;
	name: string;
	createdAt: string;
};

export type Bookmark = {
	id: string;
	folderId: string | null;
	name: string;
	url: string;
	description: string;
	createdAt: string;
};

/** How a managed server is launched. `python` → `uv run …`, `node` → `npm run dev`. */
export type ServerType = 'python' | 'node';

export type ManagedServer = {
	id: string;
	alias: string;
	directory: string;
	serverType: ServerType;
	/** Where the server listens: how it is started, probed and linked to. */
	port: number;
	docker: boolean;
	dockerCommand: string;
	pid: number | null;
	startedAt: string | null;
	logPath: string | null;
	createdAt: string;
};

/** Editable subset of a ManagedServer — what the add/edit form submits. */
export type ManagedServerDraft = {
	alias: string;
	directory: string;
	serverType: ServerType;
	port: number;
	docker: boolean;
	dockerCommand: string;
};

/** What a directory scan concluded about a candidate project folder. */
export type ServerDetection = {
	directory: string;
	exists: boolean;
	alias: string;
	serverType: ServerType | null;
	/** The port the project configures for itself, if we could find one. */
	port: number | null;
	/** Where that port came from, e.g. `.env (PORT)`. Null when none was found. */
	portSource: string | null;
	docker: boolean;
	dockerCommand: string;
	markers: string[];
};

export type DockerServiceStatus = {
	name: string;
	state: string;
};

export type ServerStatus = {
	id: string;
	checkedAt: string;
	/** The process we launched: alive, or gone/never-started. */
	process: {
		state: 'running' | 'stopped';
		pid: number | null;
		startedAt: string | null;
	};
	port: {
		configured: number;
		listening: boolean;
	};
	docker: {
		enabled: boolean;
		state: 'running' | 'partial' | 'stopped' | 'unknown';
		services: DockerServiceStatus[];
		error: string | null;
	};
};

/** A managed server plus its freshly-probed status, as the launcher renders it. */
export type ManagedServerWithStatus = ManagedServer & { status: ServerStatus };

/** One entry in the directory picker. */
export type DirectoryEntry = {
	name: string;
	path: string;
	/** True when the folder looks like a launchable project (has a marker file). */
	isProject: boolean;
};

export type DirectoryListing = {
	path: string;
	/** Null at a filesystem root, where there is nowhere further up to go. */
	parent: string | null;
	entries: DirectoryEntry[];
};

/** Editable subset of a Bookmark — used by the inline edit/create forms. */
export type BookmarkDraft = {
	name: string;
	url: string;
	description: string;
};

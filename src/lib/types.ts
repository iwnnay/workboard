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

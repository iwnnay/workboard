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

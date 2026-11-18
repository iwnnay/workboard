import { invalidate } from '$app/navigation';

export const projectsInvalidationKey = 'app:projects';

const createProjectsManager = () => {
	let open = $state(false);
	let focusProjectId = $state<string | null>(null);

	return {
		get open() {
			return open;
		},
		get focusProjectId() {
			return focusProjectId;
		},
		show: (projectId: string | null = null) => {
			focusProjectId = projectId;
			open = true;
		},
		hide: () => {
			open = false;
		},
		changed: () => invalidate(projectsInvalidationKey)
	};
};

export const projectsManager = createProjectsManager();

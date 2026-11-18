import { api, query } from './api';
import type { FolderListing } from './types';

export const foldersApi = {
	list: (path?: string | null) => api.get<FolderListing>(`/api/folders${query({ path })}`)
};

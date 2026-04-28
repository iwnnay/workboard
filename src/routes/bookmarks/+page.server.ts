import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { bookmark, bookmarkFolder } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const [folders, bookmarks] = await Promise.all([
		db.select().from(bookmarkFolder).orderBy(asc(bookmarkFolder.name)),
		db.select().from(bookmark).orderBy(asc(bookmark.name))
	]);
	return { folders, bookmarks };
};

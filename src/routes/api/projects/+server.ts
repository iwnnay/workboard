import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { project } from '$lib/server/db/schema';
import { asc } from 'drizzle-orm';

export async function GET() {
	const projects = await db.select().from(project).orderBy(asc(project.name));
	return json(projects);
}

export async function POST({ request }) {
	const { name, path } = await request.json();
	const [created] = await db.insert(project).values({ name, path }).returning();
	return json(created);
}

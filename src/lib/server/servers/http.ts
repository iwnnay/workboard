import { error } from '@sveltejs/kit';
import { ManagedServerNotFoundError } from './service';

/**
 * Turn a thrown service error into an HTTP error that keeps the original
 * message, so the launcher can show why a start/stop actually failed instead
 * of a bare status code. A missing record is a 404; everything else is a 400.
 */
export function failWith(operation: string, caught: unknown): never {
	const detail = caught instanceof Error ? caught.message : String(caught);
	const status = caught instanceof ManagedServerNotFoundError ? 404 : 400;
	throw error(status, `${operation}: ${detail}`);
}

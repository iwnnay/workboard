/**
 * Constants shared between client and server.
 * Server-only constants live in `$lib/server/constants.ts`.
 */

export const DEFAULT_DIFF_RANGE = 'HEAD';

/** Largest file the in-browser editor will open or save, in bytes. */
export const MAX_EDITABLE_FILE_BYTES = 2 * 1024 * 1024;

/** Max length of a bookmark description, enforced in the UI via `maxlength`. */
export const BOOKMARK_DESCRIPTION_MAX = 180;

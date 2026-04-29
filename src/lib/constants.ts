/**
 * Constants shared between client and server.
 * Server-only constants live in `$lib/server/constants.ts`.
 */

export const DEFAULT_DIFF_RANGE = 'HEAD~1';

/** Max length of a bookmark description, enforced in the UI via `maxlength`. */
export const BOOKMARK_DESCRIPTION_MAX = 180;

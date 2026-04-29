/**
 * Single-row settings tables (like `reminder`) use a fixed primary key so we
 * can upsert without tracking IDs.
 */
export const REMINDER_ID = 'singleton';

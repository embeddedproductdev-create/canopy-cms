/**
 * Columns the R2 storage plugin adds. The plugin is only active in production (src/payload.config.ts), so the schema
 * generated locally does not contain them; generate-expected-schema adds them so `verify:remote` checks them too.
 * A live media table without `_object_key` made every image 404 (SQLite returns a missing column as its own name).
 */
export const STORAGE_COLUMNS: Record<string, string[]> = {
  media: ['_object_key'],
}

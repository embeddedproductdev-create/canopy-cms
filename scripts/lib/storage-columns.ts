/**
 * Columns the R2 storage plugin adds. The plugin is only active in production (src/payload.config.ts), so the schema
 * generated locally does not contain them; generate-expected-schema adds them so `verify:remote` checks them too.
 * Names follow Payload's SQLite rule (a leading `_` plus to-snake-case), so `_objectKey` is `_objectkey`. A live media
 * table without it made every image 404 (SQLite returns a missing column as its own name).
 */
export const STORAGE_COLUMNS: Record<string, string[]> = {
  media: ['_objectkey'],
}

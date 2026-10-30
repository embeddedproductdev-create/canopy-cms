import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-d1-sqlite'
import { sql } from '@payloadcms/db-d1-sqlite'

// Payload 3.92's cloud storage stores an object-key folder per file in `media._object_key`. Without the column, SQLite
// returns the text "_objectkey" for it and every image is looked up at `_objectkey/<filename>` in R2, so none load.
// NULL means "no folder": the file is read from `<filename>`, where all existing uploads live.

type Row = Record<string, unknown>
export type Reader = (query: string) => Promise<Row[]>

export async function buildMediaObjectKey(read: Reader): Promise<string[]> {
  if (!(await read(`SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'media'`)).length) return []
  const columns = (await read(`SELECT name FROM pragma_table_info('media')`)).map((row) => String(row.name))
  return columns.includes('_object_key') ? [] : [`ALTER TABLE "media" ADD COLUMN "_object_key" text`]
}

export async function applyMediaObjectKey(db: MigrateUpArgs['db']): Promise<void> {
  const read: Reader = async (query) => (await db.all(sql.raw(query))) as Row[]
  for (const statement of await buildMediaObjectKey(read)) await db.run(sql.raw(statement))
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await applyMediaObjectKey(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  void db
}

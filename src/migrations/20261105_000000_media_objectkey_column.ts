import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-d1-sqlite'
import { sql } from '@payloadcms/db-d1-sqlite'

// Payload names the R2 plugin's `_objectKey` field's column `_objectkey` (a leading `_` plus to-snake-case, which does
// not split "objectKey"). 20261104 added `_object_key` by mistake, so the live site still read the missing column as
// the text "_objectkey" and looked every image up at `_objectkey/<filename>`. NULL here means the file sits at
// `<filename>`, where all existing uploads are.

type Row = Record<string, unknown>
export type Reader = (query: string) => Promise<Row[]>

export async function buildMediaObjectkeyColumn(read: Reader): Promise<string[]> {
  if (!(await read(`SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'media'`)).length) return []
  const columns = (await read(`SELECT name FROM pragma_table_info('media')`)).map((row) => String(row.name))
  return columns.includes('_objectkey') ? [] : [`ALTER TABLE "media" ADD COLUMN "_objectkey" text`]
}

export async function applyMediaObjectkeyColumn(db: MigrateUpArgs['db']): Promise<void> {
  const read: Reader = async (query) => (await db.all(sql.raw(query))) as Row[]
  for (const statement of await buildMediaObjectkeyColumn(read)) await db.run(sql.raw(statement))
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await applyMediaObjectkeyColumn(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  void db
}

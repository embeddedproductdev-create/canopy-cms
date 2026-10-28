import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-d1-sqlite'
import { sql } from '@payloadcms/db-d1-sqlite'

const columns = [
  { table: 'capability', name: 'hero_image_fit', definition: 'text' },
  { table: 'capability', name: 'hero_image_align', definition: 'text' },
  { table: 'industry', name: 'hero_image_fit', definition: 'text' },
  { table: 'industry', name: 'hero_image_align', definition: 'text' },
]

type Row = Record<string, unknown>
export type Reader = (query: string) => Promise<Row[]>

/** The SQL this migration needs, so it can run through Payload or straight against D1 with wrangler. */
export async function buildHeroImageFit(read: Reader): Promise<string[]> {
  const statements: string[] = []
  const tables = new Set((await read(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('capability', 'industry')`)).map((row) => String(row.name)))
  for (const column of columns) {
    if (!tables.has(column.table)) continue
    const existing = await read(`SELECT name FROM pragma_table_info('${column.table}')`)
    if (existing.some((row) => row.name === column.name)) continue
    statements.push(`ALTER TABLE "${column.table}" ADD COLUMN "${column.name}" ${column.definition}`)
  }
  // A schema push can leave the column name itself as the stored value; normalise to the real options.
  for (const table of ['capability', 'industry']) {
    if (!tables.has(table)) continue
    statements.push(`UPDATE "${table}" SET "hero_image_fit" = 'contain' WHERE "hero_image_fit" IS NULL OR "hero_image_fit" NOT IN ('contain', 'cover')`)
    statements.push(`UPDATE "${table}" SET "hero_image_align" = 'center' WHERE "hero_image_align" IS NULL OR "hero_image_align" NOT IN ('center', 'bottom')`)
  }
  return statements
}

export async function applyHeroImageFit(db: MigrateUpArgs['db']): Promise<void> {
  const read: Reader = async (query) => (await db.all(sql.raw(query))) as Row[]
  for (const statement of await buildHeroImageFit(read)) await db.run(sql.raw(statement))
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await applyHeroImageFit(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  void db
}

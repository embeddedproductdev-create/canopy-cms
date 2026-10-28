import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-d1-sqlite'
import { sql } from '@payloadcms/db-d1-sqlite'

type Column = { name: string }

const columns = [
  { table: 'capability', name: 'hero_image_fit', definition: 'text' },
  { table: 'capability', name: 'hero_image_align', definition: 'text' },
  { table: 'industry', name: 'hero_image_fit', definition: 'text' },
  { table: 'industry', name: 'hero_image_align', definition: 'text' },
]

export async function applyHeroImageFit(db: MigrateUpArgs['db']): Promise<void> {
  const tables = new Set(
    ((await db.all(sql`SELECT "name" FROM "sqlite_master" WHERE "type" = 'table'`)) as Column[]).map((row) => row.name),
  )
  for (const column of columns) {
    if (!tables.has(column.table)) continue
    const existing = (await db.all(sql.raw(`PRAGMA table_info("${column.table}")`))) as Column[]
    if (existing.some((row) => row.name === column.name)) continue
    await db.run(sql.raw(`ALTER TABLE "${column.table}" ADD COLUMN "${column.name}" ${column.definition}`))
  }
  // A schema push can leave the column name itself as the stored value; normalise to the real options.
  for (const table of ['capability', 'industry']) {
    if (!tables.has(table)) continue
    await db.run(sql.raw(`UPDATE "${table}" SET "hero_image_fit" = 'contain' WHERE "hero_image_fit" IS NULL OR "hero_image_fit" NOT IN ('contain', 'cover')`))
    await db.run(sql.raw(`UPDATE "${table}" SET "hero_image_align" = 'center' WHERE "hero_image_align" IS NULL OR "hero_image_align" NOT IN ('center', 'bottom')`))
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await applyHeroImageFit(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  void db
}

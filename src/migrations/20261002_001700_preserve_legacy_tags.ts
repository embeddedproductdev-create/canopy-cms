import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-d1-sqlite'

async function tableExists(db: MigrateUpArgs['db'], table: string): Promise<boolean> {
  const result = (await db.all(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${table} LIMIT 1`,
  )) as { name: string }[]
  return result.length > 0
}

async function addTagsColumn(db: MigrateUpArgs['db'], table: string): Promise<void> {
  if (!(await tableExists(db, table))) {
    throw new Error(`Cannot migrate tags: expected table ${table} to exist`)
  }

  const columns = (await db.all(sql.raw(`PRAGMA table_info("${table}")`))) as { name: string }[]
  if (!columns.some((column) => column.name === 'tags')) {
    await db.run(sql.raw(`ALTER TABLE "${table}" ADD COLUMN "tags" text`))
  }
}

async function copyLegacyTags(
  db: MigrateUpArgs['db'],
  sourceTable: string,
  targetTable: string,
): Promise<void> {
  if (!(await tableExists(db, sourceTable))) return

  const rows = (await db.all(
    sql.raw(`SELECT "_parent_id" AS parent_id, "tag" FROM "${sourceTable}" ORDER BY "_parent_id", "_order"`),
  )) as { parent_id: string | number | null; tag: string | null }[]
  const tagsByParent = new Map<string, string[]>()
  for (const row of rows) {
    if (row.parent_id === null || row.tag === null || row.tag === undefined) continue
    const parentID = String(row.parent_id)
    const tags = tagsByParent.get(parentID) || []
    tags.push(String(row.tag))
    tagsByParent.set(parentID, tags)
  }

  for (const [parentID, tags] of tagsByParent) {
    await db.run(
      sql`UPDATE ${sql.raw(`"${targetTable}"`)} SET "tags" = ${tags.join(', ')} WHERE "id" = ${parentID} AND ("tags" IS NULL OR "tags" = '')`,
    )
  }
}

export async function preserveLegacyTags(db: MigrateUpArgs['db']): Promise<void> {
  for (const table of ['card', 'blog', '_blog_v', 'case_study', '_case_study_v']) {
    await addTagsColumn(db, table)
  }

  await copyLegacyTags(db, 'card_tags', 'card')
  await copyLegacyTags(db, 'blog_tags', 'blog')
  await copyLegacyTags(db, '_blog_v_version_tags', '_blog_v')
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await preserveLegacyTags(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  void db
  throw new Error('The legacy tags migration is irreversible; restore the database backup instead.')
}

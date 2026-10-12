import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-d1-sqlite'

type Db = MigrateUpArgs['db']

async function tableExists(db: Db, table: string): Promise<boolean> {
  const result = (await db.all(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${table} LIMIT 1`,
  )) as { name: string }[]
  return result.length > 0
}

async function addColumn(db: Db, table: string, column: string, definition: string): Promise<void> {
  if (!(await tableExists(db, table))) return
  const columns = (await db.all(sql.raw(`PRAGMA table_info("${table}")`))) as { name: string }[]
  if (!columns.some((entry) => entry.name === column)) {
    await db.run(sql.raw(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`))
  }
}

async function createSectionRels(db: Db, owner: string): Promise<void> {
  if (!(await tableExists(db, owner))) return
  const rels = `${owner}_rels`
  await db.run(
    sql.raw(`CREATE TABLE IF NOT EXISTS "${rels}" (
      "id" integer PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" text NOT NULL,
      "section_id" integer,
      FOREIGN KEY ("parent_id") REFERENCES "${owner}"("id") ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY ("section_id") REFERENCES "section"("id") ON UPDATE no action ON DELETE cascade
    )`),
  )
  for (const column of ['order', 'parent_id', 'path', 'section_id']) {
    await db.run(
      sql.raw(`CREATE INDEX IF NOT EXISTS "${rels}_${column}_idx" ON "${rels}" ("${column}")`),
    )
  }
  await addColumn(db, rels, 'section_id', 'integer REFERENCES "section"("id") ON DELETE cascade')
}

async function createArrayTable(
  db: Db,
  table: string,
  parent: string,
  parentIdType: 'integer' | 'text',
  columns: string[],
): Promise<void> {
  if (!(await tableExists(db, parent))) return
  const cols = columns.map((column) => `"${column}" text`).join(', ')
  await db.run(
    sql.raw(`CREATE TABLE IF NOT EXISTS "${table}" (
      "_order" integer NOT NULL,
      "_parent_id" ${parentIdType} NOT NULL,
      "id" text PRIMARY KEY NOT NULL,
      ${cols},
      FOREIGN KEY ("_parent_id") REFERENCES "${parent}"("id") ON UPDATE no action ON DELETE cascade
    )`),
  )
  await db.run(sql.raw(`CREATE INDEX IF NOT EXISTS "${table}_order_idx" ON "${table}" ("_order")`))
  await db.run(
    sql.raw(`CREATE INDEX IF NOT EXISTS "${table}_parent_id_idx" ON "${table}" ("_parent_id")`),
  )
}

export async function applyWireframeContentModel(db: Db): Promise<void> {
  await addColumn(db, 'section', 'variant', 'text')
  await addColumn(db, 'section', 'columns', 'text')
  await addColumn(db, 'section', 'anchor', 'text')
  await addColumn(db, 'section', 'tags', 'text')
  await addColumn(db, 'section', 'hidden', 'integer DEFAULT 0')

  await addColumn(db, 'page', 'eyebrow', 'text')
  await addColumn(db, 'page', 'page_type', 'text')
  await addColumn(db, '_page_v', 'version_eyebrow', 'text')
  await addColumn(db, '_page_v', 'version_page_type', 'text')

  for (const owner of ['blog', '_blog_v', 'case_study', '_case_study_v']) {
    await createSectionRels(db, owner)
  }

  await addColumn(db, 'blog', 'featured', 'integer DEFAULT 0')
  await addColumn(db, '_blog_v', 'version_featured', 'integer DEFAULT 0')

  await addColumn(db, 'checklist', 'access_gate_form_anchor', 'text')
  await addColumn(db, '_checklist_v', 'version_access_gate_form_anchor', 'text')

  await db.run(
    sql.raw(`CREATE TABLE IF NOT EXISTS "form_submission" (
      "id" integer PRIMARY KEY NOT NULL,
      "form" text NOT NULL,
      "source" text,
      "name" text,
      "email" text NOT NULL,
      "company" text,
      "scope" text,
      "message" text,
      "checklist" text,
      "data" text,
      "status" text DEFAULT 'new',
      "website" text,
      "updated_at" text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
      "created_at" text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
    )`),
  )
  await db.run(sql.raw('CREATE INDEX IF NOT EXISTS "form_submission_status_idx" ON "form_submission" ("status")'))
  await db.run(sql.raw('CREATE INDEX IF NOT EXISTS "form_submission_created_at_idx" ON "form_submission" ("created_at")'))
  await addColumn(
    db,
    'payload_locked_documents_rels',
    'form_submission_id',
    'integer REFERENCES "form_submission"("id") ON DELETE cascade',
  )

  await createArrayTable(db, 'header_nav_items_children', 'header_nav_items', 'text', [
    'label',
    'url',
    'description',
  ])

  await createArrayTable(db, 'site_chrome_ui_labels', 'site_chrome', 'integer', ['key', 'value'])
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await applyWireframeContentModel(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql.raw('DROP TABLE IF EXISTS "site_chrome_ui_labels"'))
  await db.run(sql.raw('DROP TABLE IF EXISTS "header_nav_items_children"'))
  for (const rels of ['blog_rels', '_blog_v_rels', 'case_study_rels', '_case_study_v_rels']) {
    await db.run(sql.raw(`DROP TABLE IF EXISTS "${rels}"`))
  }
}

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

async function index(db: Db, table: string, column: string): Promise<void> {
  await db.run(sql.raw(`CREATE INDEX IF NOT EXISTS "${table}_${column}_idx" ON "${table}" ("${column}")`))
}

async function arrayTable(db: Db, table: string, parent: string, columns: Record<string, string>): Promise<void> {
  const cols = Object.entries(columns)
    .map(([name, type]) => `"${name}" ${type}`)
    .join(', ')
  await db.run(
    sql.raw(`CREATE TABLE IF NOT EXISTS "${table}" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" text PRIMARY KEY NOT NULL,
      ${cols},
      FOREIGN KEY ("_parent_id") REFERENCES "${parent}"("id") ON UPDATE no action ON DELETE cascade
    )`),
  )
  await index(db, table, '_order')
  await index(db, table, '_parent_id')
}

async function relsTable(db: Db, owner: string, targets: Record<string, string>): Promise<void> {
  const rels = `${owner}_rels`
  const targetCols = Object.keys(targets)
    .map((column) => `"${column}" integer`)
    .join(', ')
  const targetFks = Object.entries(targets)
    .map(([column, table]) => `FOREIGN KEY ("${column}") REFERENCES "${table}"("id") ON UPDATE no action ON DELETE cascade`)
    .join(', ')
  await db.run(
    sql.raw(`CREATE TABLE IF NOT EXISTS "${rels}" (
      "id" integer PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" text NOT NULL,
      ${targetCols},
      FOREIGN KEY ("parent_id") REFERENCES "${owner}"("id") ON UPDATE no action ON DELETE cascade,
      ${targetFks}
    )`),
  )
  for (const column of ['order', 'parent_id', 'path', ...Object.keys(targets)]) await index(db, rels, column)
}

const TIMESTAMPS = `
  "updated_at" text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  "created_at" text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL`

const HERO = `
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "eyebrow" text,
  "heading" text,
  "subheading" text,
  "cta_label" text,
  "cta_href" text,
  "secondary_cta_label" text,
  "secondary_cta_href" text,
  "image_id" integer REFERENCES "media"("id") ON DELETE set null,
  "image_alt" text`

const SEO = `
  "seo_seo_title" text,
  "seo_meta_description" text,
  "seo_canonical_url" text,
  "seo_robots_index" integer DEFAULT true,
  "seo_robots_follow" integer DEFAULT true,
  "seo_keywords" text,
  "seo_og_title" text,
  "seo_og_description" text,
  "seo_og_image_id" integer REFERENCES "media"("id") ON DELETE set null,
  "seo_schema_type" text DEFAULT 'auto'`

export async function applyDetailCollections(db: Db): Promise<void> {
  await db.run(
    sql.raw(`CREATE TABLE IF NOT EXISTS "capability" (
      "id" integer PRIMARY KEY NOT NULL,${HERO},
      "included_heading" text,
      "why_heading" text,
      "why_text" text,
      "workflow_eyebrow" text,
      "workflow_heading" text,
      "workflow_intro" text,
      "workflow" text,
      "projects_heading" text,
      "insights_heading" text,
      "faq_heading" text,${SEO},${TIMESTAMPS}
    )`),
  )
  await db.run(sql.raw('CREATE UNIQUE INDEX IF NOT EXISTS "capability_slug_idx" ON "capability" ("slug")'))
  await index(db, 'capability', 'updated_at')
  await index(db, 'capability', 'created_at')
  await arrayTable(db, 'capability_included', 'capability', { title: 'text', icon: 'text', text: 'text', tags: 'text' })
  await arrayTable(db, 'capability_stacks', 'capability', {
    kind: "text DEFAULT 'rows'",
    heading: 'text',
    intro: 'text',
    items: 'text NOT NULL',
    note: 'text',
    tinted: 'integer DEFAULT false',
  })
  await arrayTable(db, 'capability_faqs', 'capability', { question: 'text NOT NULL', answer: 'text NOT NULL' })
  await relsTable(db, 'capability', { case_study_id: 'case_study', blog_id: 'blog' })

  await db.run(
    sql.raw(`CREATE TABLE IF NOT EXISTS "industry" (
      "id" integer PRIMARY KEY NOT NULL,${HERO},
      "summary" text,
      "challenges_heading" text,
      "challenges" text,
      "disciplines_heading" text,
      "disciplines" text,
      "callout_heading" text,
      "callout_text" text,
      "products_heading" text,
      "products" text,
      "projects_heading" text,
      "process_heading" text,
      "process_highlight" text,
      "process_cta_label" text,
      "process_cta_href" text,
      "process" text,
      "faq_heading" text,
      "others_heading" text,${SEO},${TIMESTAMPS}
    )`),
  )
  await db.run(sql.raw('CREATE UNIQUE INDEX IF NOT EXISTS "industry_slug_idx" ON "industry" ("slug")'))
  await index(db, 'industry', 'updated_at')
  await index(db, 'industry', 'created_at')
  await arrayTable(db, 'industry_stacks', 'industry', {
    kind: "text DEFAULT 'rows'",
    heading: 'text',
    intro: 'text',
    items: 'text NOT NULL',
    note: 'text',
    tinted: 'integer DEFAULT false',
  })
  await arrayTable(db, 'industry_faqs', 'industry', { question: 'text NOT NULL', answer: 'text NOT NULL' })
  await relsTable(db, 'industry', { case_study_id: 'case_study' })

  for (const owner of ['capability', 'industry']) {
    await addColumn(
      db,
      'payload_locked_documents_rels',
      `${owner}_id`,
      `integer REFERENCES "${owner}"("id") ON DELETE cascade`,
    )
  }

  const withSeo: [string, string][] = [
    ['page', 'seo_'],
    ['_page_v', 'version_seo_'],
    ['blog', 'seo_'],
    ['_blog_v', 'version_seo_'],
    ['case_study', 'seo_'],
    ['_case_study_v', 'version_seo_'],
    ['checklist', 'seo_'],
    ['_checklist_v', 'version_seo_'],
  ]
  for (const [table, prefix] of withSeo) {
    await addColumn(db, table, `${prefix}keywords`, 'text')
    await addColumn(db, table, `${prefix}og_title`, 'text')
    await addColumn(db, table, `${prefix}og_description`, 'text')
    await addColumn(db, table, `${prefix}og_image_id`, 'integer REFERENCES "media"("id") ON DELETE set null')
  }
  await addColumn(db, 'page', 'hero_image_id', 'integer REFERENCES "media"("id") ON DELETE set null')
  await addColumn(db, '_page_v', 'version_hero_image_id', 'integer REFERENCES "media"("id") ON DELETE set null')
  await addColumn(db, 'form_submission', 'archived_at', 'text')
  await index(db, 'form_submission', 'archived_at')
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await applyDetailCollections(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  void db
}

import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-d1-sqlite'
import { sql } from '@payloadcms/db-d1-sqlite'

type Column = { name: string }
type Db = MigrateUpArgs['db']

const columns = [
  { table: 'page', name: 'cta_label', definition: 'text' },
  { table: 'page', name: 'cta_href', definition: 'text' },
  { table: '_page_v', name: 'version_cta_label', definition: 'text' },
  { table: '_page_v', name: 'version_cta_href', definition: 'text' },
  { table: 'case_study', name: 'featured', definition: 'integer DEFAULT false' },
  { table: '_case_study_v', name: 'version_featured', definition: 'integer DEFAULT false' },
  { table: '_case_study_v', name: 'version_tags', definition: 'text' },
  { table: 'blog', name: 'category', definition: 'text' },
  { table: 'blog', name: 'image_id', definition: 'integer REFERENCES "media"("id") ON DELETE set null' },
  { table: '_blog_v', name: 'version_category', definition: 'text' },
  {
    table: '_blog_v',
    name: 'version_image_id',
    definition: 'integer REFERENCES "media"("id") ON DELETE set null',
  },
  { table: '_blog_v', name: 'version_tags', definition: 'text' },
  { table: 'checklist', name: 'heading', definition: 'text' },
  { table: 'checklist', name: 'subheading', definition: 'text' },
  { table: 'checklist', name: 'introduction', definition: 'text' },
  { table: 'checklist', name: 'items_heading', definition: 'text' },
  { table: '_checklist_v', name: 'version_heading', definition: 'text' },
  { table: '_checklist_v', name: 'version_subheading', definition: 'text' },
  { table: '_checklist_v', name: 'version_introduction', definition: 'text' },
  { table: '_checklist_v', name: 'version_items_heading', definition: 'text' },
  { table: 'seo_settings', name: 'site_icon_id', definition: 'integer REFERENCES "media"("id") ON DELETE set null' },
  { table: 'seo_settings', name: 'default_keywords', definition: 'text' },
  { table: 'site_chrome', name: 'page_states_loading', definition: "text NOT NULL DEFAULT 'Loading...'" },
  {
    table: 'site_chrome',
    name: 'page_states_load_failed',
    definition: "text NOT NULL DEFAULT 'Content could not be loaded.'",
  },
  {
    table: 'site_chrome',
    name: 'accessibility_skip_to_main',
    definition: "text NOT NULL DEFAULT 'Skip to main content'",
  },
  {
    table: 'site_chrome',
    name: 'accessibility_primary_navigation',
    definition: "text NOT NULL DEFAULT 'Primary navigation'",
  },
  { table: 'site_chrome', name: 'accessibility_home_link', definition: "text NOT NULL DEFAULT 'Canopy home'" },
  {
    table: 'site_chrome',
    name: 'accessibility_open_navigation',
    definition: "text NOT NULL DEFAULT 'Open navigation menu'",
  },
  {
    table: 'site_chrome',
    name: 'accessibility_close_navigation',
    definition: "text NOT NULL DEFAULT 'Close navigation menu'",
  },
  { table: 'site_chrome', name: 'accessibility_close_dialog', definition: "text NOT NULL DEFAULT 'Close dialog'" },
  { table: 'site_chrome', name: 'accessibility_checklist_areas', definition: "text NOT NULL DEFAULT 'Checklist areas'" },
]

export async function applyContentColumns(db: Db): Promise<void> {
  const existingTables = new Set(
    ((await db.all(sql`SELECT "name" FROM "sqlite_master" WHERE "type" = 'table'`)) as Column[]).map((row) => row.name),
  )

  for (const column of columns) {
    if (!existingTables.has(column.table)) continue
    const existingColumns = (await db.all(sql.raw(`PRAGMA table_info("${column.table}")`))) as Column[]
    if (existingColumns.some((row) => row.name === column.name)) continue
    await db.run(sql.raw(`ALTER TABLE "${column.table}" ADD COLUMN "${column.name}" ${column.definition}`))
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await applyContentColumns(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  void db
}

import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-d1-sqlite'

export type Row = Record<string, unknown>
export type Reader = (query: string) => Promise<Row[]>

const q = (value: string): string => `'${value.replace(/'/g, "''")}'`

const str = (value: unknown): string => (value === null || value === undefined ? '' : String(value))

// Header menu, footer link groups / social links, robots disallow paths and the UI label registry moved from
// repeating-row tables to one JSON field each. The REST shape of the first three is unchanged.
const TARGETS = [
  { table: 'header', column: 'nav_items' },
  { table: 'footer', column: 'link_groups' },
  { table: 'footer', column: 'social_links' },
  { table: 'seo_settings', column: 'disallow_paths' },
  { table: 'site_chrome', column: 'ui_labels' },
]

const LEGACY_TABLES = [
  'header_nav_items_children',
  'header_nav_items',
  'footer_link_groups_links',
  'footer_link_groups',
  'footer_social_links',
  'seo_settings_disallow_paths',
  'site_chrome_ui_labels',
]

async function tableExists(read: Reader, name: string): Promise<boolean> {
  return (await read(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${q(name)}`)).length > 0
}

async function rows(read: Reader, table: string, order = '"_order"'): Promise<Row[]> {
  return (await tableExists(read, table)) ? read(`SELECT * FROM "${table}" ORDER BY ${order}`) : []
}

export async function buildJsonSiteSettings(read: Reader): Promise<string[]> {
  const statements: string[] = []

  for (const { table, column } of TARGETS) {
    const columns = await read(`PRAGMA table_info("${table}")`)
    if (!columns.some((c) => c.name === column)) statements.push(`ALTER TABLE "${table}" ADD COLUMN "${column}" text`)
  }

  const navChildren = await rows(read, 'header_nav_items_children')
  const navItems = (await rows(read, 'header_nav_items')).map((item) => {
    const children = navChildren
      .filter((child) => str(child._parent_id) === str(item.id))
      .map((child) => ({ label: str(child.label), url: str(child.url), ...(str(child.description) ? { description: str(child.description) } : {}) }))
    return { label: str(item.label), url: str(item.url), ...(children.length ? { children } : {}) }
  })

  const groupLinks = await rows(read, 'footer_link_groups_links')
  const linkGroups = (await rows(read, 'footer_link_groups')).map((group) => ({
    heading: str(group.heading),
    links: groupLinks.filter((link) => str(link._parent_id) === str(group.id)).map((link) => ({ label: str(link.label), href: str(link.href) })),
  }))

  const socialLinks = (await rows(read, 'footer_social_links')).map((link) => ({ label: str(link.label), href: str(link.href), icon: str(link.icon) || str(link.label).toLowerCase() }))
  const disallowPaths = (await rows(read, 'seo_settings_disallow_paths')).map((entry) => str(entry.path)).filter(Boolean)
  const uiLabels = Object.fromEntries((await rows(read, 'site_chrome_ui_labels')).filter((entry) => str(entry.key)).map((entry) => [str(entry.key), str(entry.value)]))

  const values: Record<string, unknown> = { nav_items: navItems, link_groups: linkGroups, social_links: socialLinks, disallow_paths: disallowPaths, ui_labels: uiLabels }
  for (const { table, column } of TARGETS) {
    // Only fill a column that is still empty so re-running never overwrites edits made in the admin.
    statements.push(`UPDATE "${table}" SET "${column}" = ${q(JSON.stringify(values[column]))} WHERE ("${column}" IS NULL OR "${column}" = '')`)
  }
  for (const table of LEGACY_TABLES) if (await tableExists(read, table)) statements.push(`DELETE FROM "${table}"`)
  return statements
}

export async function applyJsonSiteSettings(db: MigrateUpArgs['db']): Promise<void> {
  const read: Reader = async (query) => (await db.all(sql.raw(query))) as Row[]
  for (const statement of await buildJsonSiteSettings(read)) await db.run(sql.raw(statement))
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await applyJsonSiteSettings(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  void db
}

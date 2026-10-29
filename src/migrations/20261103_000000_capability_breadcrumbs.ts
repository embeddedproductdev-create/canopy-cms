import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-d1-sqlite'
import { sql } from '@payloadcms/db-d1-sqlite'
import { randomBytes } from 'node:crypto'

/**
 * Capabilities no longer have hidden layout sections. The only one left after 20261102 is the hero section, which
 * held the breadcrumb (e.g. Capabilities > Deep Firmware Engineering). This copies that breadcrumb into the new
 * Hero > Breadcrumb field (unless it already has one), then unlinks and deletes those sections.
 */

type Row = Record<string, unknown>
export type Reader = (query: string) => Promise<Row[]>

const q = (value: unknown) => `'${String(value).replace(/'/g, "''")}'`
const nul = (value: unknown) => (value === null || value === undefined || String(value).trim() === '' ? 'NULL' : q(value))

export async function buildCapabilityBreadcrumbsSchema(read: Reader): Promise<string[]> {
  if ((await read(`SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'capability_hero_breadcrumbs'`)).length) return []
  return [
    `CREATE TABLE "capability_hero_breadcrumbs" ("_order" integer NOT NULL, "_parent_id" integer NOT NULL, "id" text PRIMARY KEY NOT NULL, "label" text NOT NULL, "url" text, FOREIGN KEY ("_parent_id") REFERENCES "capability"("id") ON UPDATE no action ON DELETE cascade)`,
    `CREATE INDEX IF NOT EXISTS "capability_hero_breadcrumbs_order_idx" ON "capability_hero_breadcrumbs" ("_order")`,
    `CREATE INDEX IF NOT EXISTS "capability_hero_breadcrumbs_parent_id_idx" ON "capability_hero_breadcrumbs" ("_parent_id")`,
  ]
}

export async function buildCapabilityBreadcrumbs(read: Reader): Promise<string[]> {
  const columns = (await read(`SELECT name FROM pragma_table_info('capability_rels')`)).map((row) => String(row.name))
  if (!columns.includes('section_id')) return []
  const links = await read(`SELECT "id", "parent_id", "section_id" FROM "capability_rels" WHERE "path" = 'layoutSections' ORDER BY "parent_id", "order"`)
  if (!links.length) return []
  const statements: string[] = []
  const filled = new Set((await read(`SELECT DISTINCT "_parent_id" AS id FROM "capability_hero_breadcrumbs"`)).map((row) => Number(row.id)))
  const sectionIds = [...new Set(links.map((link) => Number(link.section_id)))]
  const list = sectionIds.join(', ')
  const crumbs = await read(
    `SELECT r."parent_id" AS section, c."title", c."cta_url" FROM "section_rels" r JOIN "card" c ON c."id" = r."card_id" JOIN "section" s ON s."id" = r."parent_id" WHERE r."parent_id" IN (${list}) AND s."section_key" = 'hero' AND c."type" = 'breadcrumb' ORDER BY r."parent_id", r."order"`,
  )
  for (const link of links) {
    const owner = Number(link.parent_id)
    if (filled.has(owner)) continue
    const own = crumbs.filter((crumb) => Number(crumb.section) === Number(link.section_id) && String(crumb.title ?? '').trim())
    if (!own.length) continue
    filled.add(owner)
    own.forEach((crumb, index) =>
      statements.push(
        `INSERT INTO "capability_hero_breadcrumbs" ("_order", "_parent_id", "id", "label", "url") VALUES (${index + 1}, ${owner}, ${q(randomBytes(12).toString('hex'))}, ${q(String(crumb.title).trim())}, ${nul(crumb.cta_url)})`,
      ),
    )
  }
  statements.push(`DELETE FROM "capability_rels" WHERE "id" IN (${links.map((link) => Number(link.id)).join(', ')})`)

  // Delete the sections unless another page still links to them.
  const relTables = (
    await read(
      `SELECT m."name" AS t FROM sqlite_master m JOIN pragma_table_info(m."name") p WHERE m."type" = 'table' AND m."name" LIKE '%\\_rels' ESCAPE '\\' AND m."name" NOT LIKE '_cf_%' AND p."name" = 'section_id'`,
    )
  ).map((row) => String(row.t))
  const shared = new Set<number>()
  for (const table of relTables) {
    const self = table === 'capability_rels' ? ` AND "path" <> 'layoutSections'` : ''
    for (const row of await read(`SELECT DISTINCT "section_id" AS id FROM "${table}" WHERE "section_id" IN (${list})${self}`)) shared.add(Number(row.id))
  }
  const unused = sectionIds.filter((id) => !shared.has(id))
  if (unused.length) {
    const ids = unused.join(', ')
    const cards = (
      await read(
        `SELECT DISTINCT "card_id" AS id FROM "section_rels" WHERE "parent_id" IN (${ids}) AND "card_id" IS NOT NULL AND "card_id" NOT IN (SELECT "card_id" FROM "section_rels" WHERE "parent_id" NOT IN (${ids}) AND "card_id" IS NOT NULL)`,
      )
    ).map((row) => Number(row.id))
    statements.push(`DELETE FROM "section_rels" WHERE "parent_id" IN (${ids})`)
    if (cards.length) statements.push(`DELETE FROM "card" WHERE "id" IN (${cards.join(', ')})`)
    statements.push(`DELETE FROM "section" WHERE "id" IN (${ids})`)
  }
  return statements
}

export async function applyCapabilityBreadcrumbs(db: MigrateUpArgs['db']): Promise<void> {
  const read: Reader = async (query) => (await db.all(sql.raw(query))) as Row[]
  for (const statement of await buildCapabilityBreadcrumbsSchema(read)) await db.run(sql.raw(statement))
  for (const statement of await buildCapabilityBreadcrumbs(read)) await db.run(sql.raw(statement))
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await applyCapabilityBreadcrumbs(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  void db
}

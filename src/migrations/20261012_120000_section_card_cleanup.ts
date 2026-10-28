import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-d1-sqlite'

export type Row = Record<string, unknown>
export type Reader = (query: string) => Promise<Row[]>

const q = (value: unknown): string => `'${String(value ?? '').replace(/'/g, "''")}'`

const textNode = (text: string) => ({ type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text, version: 1 })

const paragraph = (text: string) => ({
  type: 'paragraph',
  children: [textNode(text)],
  direction: null as string | null,
  format: '',
  indent: 0,
  textFormat: 0,
  textStyle: '',
  version: 1,
})

const bulletList = (items: string[]) => ({
  type: 'list',
  listType: 'bullet',
  tag: 'ul',
  start: 1,
  children: items.map((item, index) => ({
    type: 'listitem',
    value: index + 1,
    children: [textNode(item)],
    direction: null as string | null,
    format: '',
    indent: 0,
    version: 1,
  })),
  direction: null as string | null,
  format: '',
  indent: 0,
  version: 1,
})

const lexicalRoot = (children: unknown[]): string =>
  JSON.stringify({ root: { type: 'root', children, direction: null as string | null, format: '', indent: 0, version: 1 } })

const csvItems = (value: unknown): string[] =>
  String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

const capitalise = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1)

const keyLabel = (key: string): string => (key === 'cta' ? 'CTA' : capitalise(key.replace(/-/g, ' ')))

const SEPARATOR_COLUMNS: [string, string][] = [
  ['page_pills', 'label'],
  ['_page_v_version_pills', 'label'],
  ['case_study_at_a_glance', 'value'],
  ['_case_study_v_version_at_a_glance', 'value'],
  ['blog', 'category'],
  ['blog', 'body'],
  ['_blog_v', 'version_category'],
  ['_blog_v', 'version_body'],
  ['footer', 'sub_heading'],
  ['capability_stacks', 'items'],
  ['industry', 'eyebrow'],
]

const PROJECT_LINES: [string, string, string][] = [
  ['smart-bms', 'Battery management system built%', '4-cell, 20A battery management with fuel gauge, protection circuitry and OTA-ready firmware, from one team.'],
  ['dual-channel-charger', 'Two independent channels%', 'Two independent 100W charging channels, power electronics and control firmware engineered together.'],
  ['ble-mesh-rs485-energy-meter', 'Mesh-networked retrofit node%', 'BLE Mesh upstream, RS485/Modbus down to the meter, one board.'],
]

export async function buildSectionCardCleanup(read: Reader): Promise<string[]> {
  const statements: string[] = []

  const sectionTitles = await read(`SELECT "id", "title" FROM "section" WHERE "title" LIKE '% · %'`)
  if (sectionTitles.length) {
    const caseStudies = new Map((await read(`SELECT "slug", "title" FROM "case_study"`)).map((r) => [String(r.slug), String(r.title)]))
    const blogs = new Map((await read(`SELECT "slug", "title" FROM "blog"`)).map((r) => [String(r.slug), String(r.title)]))
    for (const row of sectionTitles) {
      const [owner, key] = String(row.title).split(' · ')
      let ownerName = capitalise(owner)
      if (owner.startsWith('case-study:')) ownerName = caseStudies.get(owner.slice('case-study:'.length)) ?? ownerName
      if (owner.startsWith('blog:')) ownerName = blogs.get(owner.slice('blog:'.length)) ?? ownerName
      statements.push(`UPDATE "section" SET "title" = ${q(`${ownerName} - ${keyLabel(key ?? '')}`)} WHERE "id" = ${Number(row.id)}`)
    }
  }

  const todo = (await read(`SELECT "id" FROM "section" WHERE "section_key" = 'spec-fields-needed'`)).map((r) => Number(r.id))
  if (todo.length) {
    const ids = todo.join(', ')
    const relTables = (await read(`SELECT "name" FROM "sqlite_master" WHERE "type" = 'table' AND "name" LIKE '%_rels'`)).map((r) => String(r.name))
    for (const table of relTables) {
      const columns = (await read(`PRAGMA table_info("${table}")`)).map((r) => String(r.name))
      if (columns.includes('section_id')) statements.push(`DELETE FROM "${table}" WHERE "section_id" IN (${ids})`)
      if (table === 'section_rels') statements.push(`DELETE FROM "section_rels" WHERE "parent_id" IN (${ids})`)
    }
    statements.push(`DELETE FROM "section" WHERE "id" IN (${ids})`)
  }

  statements.push(
    `UPDATE "section" SET "subheading" = NULL WHERE "section_key" = 'specs-note' AND "subheading" LIKE 'Written the way a phone spec sheet%'`,
    `UPDATE "section" SET "heading" = "heading" || ' **' || "highlight" || '**', "highlight" = NULL WHERE coalesce("highlight", '') <> '' AND "heading" NOT LIKE '%**%'`,
    `UPDATE "section" SET "tags" = "columns" WHERE "type" = 'table' AND coalesce("tags", '') = '' AND coalesce("columns", '') <> ''`,
    `UPDATE "section" SET "subheading" = "tag_line" WHERE "type" = 'subscribe' AND coalesce("subheading", '') = '' AND coalesce("tag_line", '') <> ''`,
  )

  const forms = await read(
    `SELECT "id", "summary", "tag_line" FROM "section" WHERE "type" = 'form' AND "body" IS NULL AND (coalesce("summary", '') <> '' OR coalesce("tag_line", '') <> '')`,
  )
  for (const row of forms) {
    const lines = [row.summary, row.tag_line].map((line) => String(line ?? '').trim()).filter(Boolean)
    statements.push(`UPDATE "section" SET "body" = ${q(lexicalRoot(lines.map(paragraph)))} WHERE "id" = ${Number(row.id)}`)
  }

  const stepCards = await read(
    `SELECT DISTINCT c."id" AS "id", c."tags" AS "tags" FROM "card" c
     JOIN "section_rels" r ON r."card_id" = c."id"
     JOIN "section" s ON s."id" = r."parent_id"
     WHERE s."type" = 'steps' AND s."variant" LIKE '%hover%' AND coalesce(c."tags", '') <> '' AND c."description" IS NULL`,
  )
  for (const row of stepCards) {
    statements.push(
      `UPDATE "card" SET "description" = ${q(lexicalRoot([bulletList(csvItems(row.tags))]))}, "tags" = NULL WHERE "id" = ${Number(row.id)}`,
    )
  }

  statements.push(
    `UPDATE "card" SET "subheading" = "heading" WHERE coalesce("subheading", '') = '' AND coalesce("heading", '') <> ''`,
    `UPDATE "card" SET "subheading" = "role" WHERE coalesce("subheading", '') = '' AND coalesce("role", '') <> ''`,
    `UPDATE "card" SET "value" = "category" WHERE "type" = 'field' AND coalesce("value", '') = '' AND coalesce("category", '') <> ''`,
    `UPDATE "card" SET "short_description" = NULL WHERE "short_description" LIKE '[ One-line bio%'`,
  )

  for (const [slug, oldPattern, line] of PROJECT_LINES) {
    statements.push(
      `UPDATE "case_study" SET "subheading" = ${q(line)} WHERE "slug" = ${q(slug)} AND "subheading" LIKE ${q(oldPattern)}`,
      `UPDATE "_case_study_v" SET "version_subheading" = ${q(line)} WHERE "version_slug" = ${q(slug)} AND "version_subheading" LIKE ${q(oldPattern)}`,
    )
  }

  const tables = new Set(
    (await read(`SELECT "name" FROM "sqlite_master" WHERE "type" = 'table'`)).map((row) => String(row.name)),
  )
  for (const [table, column] of SEPARATOR_COLUMNS) {
    if (!tables.has(table)) continue
    const columns = new Set((await read(`PRAGMA table_info("${table}")`)).map((row) => String(row.name)))
    if (!columns.has(column)) continue
    statements.push(`UPDATE "${table}" SET "${column}" = REPLACE("${column}", ' · ', ' - ') WHERE "${column}" LIKE '% · %'`)
  }

  for (const [table, prefix] of [
    ['checklist', ''],
    ['_checklist_v', 'version_'],
  ]) {
    if (!tables.has(table)) continue
    const columns = new Set((await read(`PRAGMA table_info("${table}")`)).map((row) => String(row.name)))
    const emailPlaceholder = `${prefix}access_gate_email_placeholder`
    const companyPlaceholder = `${prefix}access_gate_company_placeholder`
    if (columns.has(emailPlaceholder)) {
      statements.push(
        `UPDATE "${table}" SET "${emailPlaceholder}" = 'you@company.com' WHERE "${emailPlaceholder}" = 'Enter your work email'`,
      )
    }
    if (columns.has(companyPlaceholder)) {
      statements.push(
        `UPDATE "${table}" SET "${companyPlaceholder}" = 'Company name' WHERE "${companyPlaceholder}" = 'Enter your company name'`,
      )
    }
  }

  return statements
}

export async function applySectionCardCleanup(db: MigrateUpArgs['db']): Promise<void> {
  const statements = await buildSectionCardCleanup(async (query) => (await db.all(sql.raw(query))) as Row[])
  for (const statement of statements) await db.run(sql.raw(statement))
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await applySectionCardCleanup(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  void db
}

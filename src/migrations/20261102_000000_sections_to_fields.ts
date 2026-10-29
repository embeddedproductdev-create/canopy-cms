import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-d1-sqlite'
import { sql } from '@payloadcms/db-d1-sqlite'
import { randomBytes } from 'node:crypto'
import { buildVersionRepair } from '../utilities/versionRepair'

/**
 * Portfolio, Capability and Industry content still lived in hidden "layout sections" (section + card rows), so the
 * admin forms looked empty. This copies each section into the matching form field (the reverse of
 * 20261014_restructure_collections), then unlinks and deletes the section. A field that already has a value is never
 * overwritten. Sections it cannot map (and hidden ones) stay linked. The capability/industry hero section stays linked
 * for its breadcrumbs, emptied of the content that moved. It also drops slugs of deleted documents from related lists
 * and deletes sections nothing links to any more.
 */

type Row = Record<string, unknown>
export type Reader = (query: string) => Promise<Row[]>

const q = (value: unknown) => `'${String(value).replace(/'/g, "''")}'`
const nul = (value: unknown) => (value === null || value === undefined || value === '' ? 'NULL' : q(value))
const text = (value: unknown) => (value === null || value === undefined ? '' : String(value).trim())
const empty = (value: unknown) => text(value) === ''
const newId = () => randomBytes(12).toString('hex')
const hasVariant = (section: Row, token: string) => text(section.variant).split(/\s+/).includes(token)

/** Plain text of a Lexical rich-text value (used for stack notes). */
function plainText(value: unknown): string {
  if (!value) return ''
  let root: unknown = value
  if (typeof value === 'string') {
    try {
      root = JSON.parse(value)
    } catch {
      return value
    }
  }
  const walk = (node: unknown): string[] => {
    if (!node || typeof node !== 'object') return []
    const record = node as Row
    if (typeof record.text === 'string') return [record.text]
    const children = Array.isArray(record.children) ? record.children : record.root ? [record.root] : []
    return [children.map((child) => walk(child).join('')).join(record.type === 'root' ? '\n' : '')]
  }
  return walk(root).join('').trim()
}

const line = (...parts: unknown[]) => {
  const values = parts.map(text)
  while (values.length > 1 && !values[values.length - 1]) values.pop()
  return values.join(' | ')
}

// New Portfolio fields: Features, Specifications heading/intro and Engineering gap.
const COLUMNS: [string, string][] = [
  ['case_study', 'features_heading'],
  ['case_study', 'features_intro'],
  ['case_study', 'specs_heading'],
  ['case_study', 'specs_intro'],
  ['case_study', 'gap_heading'],
  ['_case_study_v', 'version_features_heading'],
  ['_case_study_v', 'version_features_intro'],
  ['_case_study_v', 'version_specs_heading'],
  ['_case_study_v', 'version_specs_intro'],
  ['_case_study_v', 'version_gap_heading'],
]
const TABLES: { name: string; create: string }[] = [
  {
    name: 'case_study_features_items',
    create: `CREATE TABLE "case_study_features_items" ("_order" integer NOT NULL, "_parent_id" integer NOT NULL, "id" text PRIMARY KEY NOT NULL, "text" text NOT NULL, FOREIGN KEY ("_parent_id") REFERENCES "case_study"("id") ON UPDATE no action ON DELETE cascade)`,
  },
  {
    name: 'case_study_gap_cards',
    create: `CREATE TABLE "case_study_gap_cards" ("_order" integer NOT NULL, "_parent_id" integer NOT NULL, "id" text PRIMARY KEY NOT NULL, "title" text NOT NULL, "text" text, FOREIGN KEY ("_parent_id") REFERENCES "case_study"("id") ON UPDATE no action ON DELETE cascade)`,
  },
  {
    name: '_case_study_v_version_features_items',
    create: `CREATE TABLE "_case_study_v_version_features_items" ("_order" integer NOT NULL, "_parent_id" integer NOT NULL, "id" integer PRIMARY KEY NOT NULL, "text" text, "_uuid" text, FOREIGN KEY ("_parent_id") REFERENCES "_case_study_v"("id") ON UPDATE no action ON DELETE cascade)`,
  },
  {
    name: '_case_study_v_version_gap_cards',
    create: `CREATE TABLE "_case_study_v_version_gap_cards" ("_order" integer NOT NULL, "_parent_id" integer NOT NULL, "id" integer PRIMARY KEY NOT NULL, "title" text, "text" text, "_uuid" text, FOREIGN KEY ("_parent_id") REFERENCES "_case_study_v"("id") ON UPDATE no action ON DELETE cascade)`,
  },
]

export async function buildSectionsToFieldsSchema(read: Reader): Promise<string[]> {
  const statements: string[] = []
  const tables = new Set((await read(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '_cf_%'`)).map((row) => String(row.name)))
  for (const [table, column] of COLUMNS) {
    if (!tables.has(table)) continue
    const existing = (await read(`SELECT name FROM pragma_table_info('${table}')`)).map((row) => String(row.name))
    if (!existing.includes(column)) statements.push(`ALTER TABLE "${table}" ADD COLUMN "${column}" text`)
  }
  for (const table of TABLES) {
    if (tables.has(table.name)) continue
    statements.push(
      table.create,
      `CREATE INDEX IF NOT EXISTS "${table.name}_order_idx" ON "${table.name}" ("_order")`,
      `CREATE INDEX IF NOT EXISTS "${table.name}_parent_id_idx" ON "${table.name}" ("_parent_id")`,
    )
  }
  return statements
}

type Owner = 'capability' | 'industry' | 'case_study'

export async function buildSectionsToFields(read: Reader): Promise<string[]> {
  const statements: string[] = []
  const tables = new Set((await read(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '_cf_%'`)).map((row) => String(row.name)))
  // Every read is a separate wrangler call against D1, so the data is loaded in a few bulk queries up front.
  const columnCache = new Map<string, Set<string>>()
  for (const row of await read(`SELECT m."name" AS t, p."name" AS c FROM sqlite_master m JOIN pragma_table_info(m."name") p WHERE m."type" = 'table' AND m."name" NOT LIKE 'sqlite_%' AND m."name" NOT LIKE '_cf_%'`)) {
    const set = columnCache.get(String(row.t)) ?? new Set<string>()
    set.add(String(row.c))
    columnCache.set(String(row.t), set)
  }
  const columnsOf = async (table: string) => {
    if (!columnCache.has(table)) columnCache.set(table, new Set((await read(`SELECT name FROM pragma_table_info('${table}')`)).map((row) => String(row.name))))
    return columnCache.get(table)!
  }
  const slugIds = async (table: string) => new Map((await read(`SELECT id, slug FROM "${table}"`)).map((row) => [text(row.slug), Number(row.id)]))
  const projects = await slugIds('case_study')
  const posts = await slugIds('blog')
  const slugsOf = (tags: unknown) => text(tags).split(',').map((slug) => slug.trim()).filter(Boolean)
  const cardsBySection = new Map<number, Row[]>()
  for (const card of await read(`SELECT c.*, r."parent_id" AS section_ref FROM "section_rels" r JOIN "card" c ON c."id" = r."card_id" WHERE r."path" = 'cards' ORDER BY r."parent_id", r."order"`)) {
    const list = cardsBySection.get(Number(card.section_ref)) ?? []
    list.push(card)
    cardsBySection.set(Number(card.section_ref), list)
  }
  const cardsOf = async (sectionId: unknown) => cardsBySection.get(Number(sectionId)) ?? []
  const parentsCache = new Map<string, Set<number>>()
  const parentsOf = async (table: string) => {
    if (!parentsCache.has(table)) parentsCache.set(table, new Set((await read(`SELECT DISTINCT "_parent_id" AS id FROM "${table}"`)).map((row) => Number(row.id))))
    return parentsCache.get(table)!
  }

  const removed: number[] = []
  const unlinked = new Map<string, Set<number>>()
  const changedProjects: number[] = []

  const convert = async (owner: Owner) => {
    if (!tables.has(owner) || !tables.has(`${owner}_rels`)) return
    const ownerColumns = await columnsOf(owner)
    const layout = await read(
      `SELECT s.*, r."id" AS rel_id, r."parent_id" AS owner_ref FROM "${owner}_rels" r JOIN "section" s ON s."id" = r."section_id" WHERE r."path" = 'layoutSections' ORDER BY r."parent_id", r."order"`,
    )
    const paths = new Set((await read(`SELECT DISTINCT "parent_id" || ':' || "path" AS k FROM "${owner}_rels"`)).map((row) => String(row.k)))
    for (const doc of await read(`SELECT * FROM "${owner}" ORDER BY "id"`)) {
      const id = Number(doc.id)
      const linked = layout.filter((section) => Number(section.owner_ref) === id)
      if (!linked.length) continue
      const updates = new Map<string, string>()
      const set = (column: string, value: unknown) => {
        if (!ownerColumns.has(column) || empty(value) || !empty(doc[column]) || updates.has(column)) return
        updates.set(column, nul(value))
      }
      const filledArrays = new Set<string>()
      const arrayEmpty = async (table: string) => {
        if (!tables.has(table) || filledArrays.has(table)) return false
        return !(await parentsOf(table)).has(id)
      }
      const relsEmpty = async (path: string) => !paths.has(`${id}:${path}`)
      const converted: Row[] = []
      const stacks: Row[] = []
      const specs: Row[] = []
      const p = owner === 'capability' ? { stacks: 'capability_technology_stacks', faqs: 'capability_faq_faqs' } : { stacks: 'industry_stacks', faqs: 'industry_faqs' }
      const col = (capability: string, industry: string) => (owner === 'capability' ? capability : industry)

      for (const section of linked) {
        if (Number(section.hidden)) continue
        const key = text(section.section_key)
        const cards = await cardsOf(section.id)
        if (owner !== 'case_study' && key === 'hero') {
          set(col('hero_eyebrow', 'eyebrow'), section.eyebrow)
          set(col('hero_heading', 'heading'), section.heading)
          set(col('hero_subheading', 'subheading'), section.subheading)
          set(col('hero_cta_label', 'cta_label'), section.cta_label)
          set(col('hero_cta_href', 'cta_href'), section.cta_href)
          set(col('hero_secondary_cta_label', 'secondary_cta_label'), section.secondary_cta_label)
          set(col('hero_secondary_cta_href', 'secondary_cta_href'), section.secondary_cta_href)
          if (section.image_id) set(col('hero_image_id', 'image_id'), Number(section.image_id))
          const content = ['eyebrow', 'heading', 'subheading', 'cta_label', 'cta_href', 'secondary_cta_label', 'secondary_cta_href', 'image_id'].filter((c) => !empty(section[c]))
          if (content.length) statements.push(`UPDATE "section" SET ${content.map((c) => `"${c}" = NULL`).join(', ')} WHERE "id" = ${Number(section.id)}`)
          continue
        }
        if (key.startsWith('stack-') && owner !== 'case_study') {
          stacks.push({ ...section, cards })
          converted.push(section)
          continue
        }
        const relate = async (path: string, column: string, ids: Map<string, number>) => {
          if (!(await relsEmpty(path))) return
          slugsOf(section.tags)
            .map((slug) => ids.get(slug))
            .filter((value): value is number => value !== undefined)
            .forEach((target, index) => statements.push(`INSERT INTO "${owner}_rels" ("order", "parent_id", "path", "${column}") VALUES (${index + 1}, ${id}, ${q(path)}, ${target})`))
        }
        const faqs = async (table: string) => {
          if (!(await arrayEmpty(table))) return
          filledArrays.add(table)
          cards.forEach((card, index) => statements.push(`INSERT INTO "${table}" ("_order", "_parent_id", "id", "question", "answer") VALUES (${index + 1}, ${id}, ${q(newId())}, ${q(text(card.title))}, ${nul(card.short_description)})`))
        }
        const lines = (withUrl = false) => cards.map((card) => (withUrl ? line(card.title, card.short_description, card.cta_url) : line(card.title, card.short_description))).join('\n')

        if (owner === 'capability') {
          switch (key) {
            case 'included':
              set('scope_included_heading', section.heading)
              if (await arrayEmpty('capability_scope_included')) {
                filledArrays.add('capability_scope_included')
                cards.forEach((card, index) =>
                  statements.push(`INSERT INTO "capability_scope_included" ("_order", "_parent_id", "id", "title", "icon", "text", "tags") VALUES (${index + 1}, ${id}, ${q(newId())}, ${q(text(card.title))}, ${nul(card.icon)}, ${nul(card.short_description)}, ${nul(card.tags)})`),
                )
              }
              break
            case 'why':
              set('scope_why_heading', section.heading)
              set('scope_why_text', section.subheading)
              break
            case 'workflow':
              set('process_workflow_eyebrow', section.eyebrow)
              set('process_workflow_heading', section.heading)
              set('process_workflow_intro', section.subheading)
              set('process_workflow', lines())
              break
            case 'projects':
              set('related_projects_heading', section.heading)
              await relate('related.relatedProjects', 'case_study_id', projects)
              break
            case 'insights':
              set('related_insights_heading', section.heading)
              await relate('related.relatedInsights', 'blog_id', posts)
              break
            case 'faq':
              set('faq_faq_heading', section.heading)
              await faqs(p.faqs)
              break
            default:
              continue
          }
        } else if (owner === 'industry') {
          switch (key) {
            case 'challenges':
              set('challenges_heading', section.heading)
              set('challenges', lines())
              break
            case 'disciplines':
              set('disciplines_heading', section.heading)
              set('disciplines', lines(true))
              break
            case 'one-team':
              set('callout_heading', section.heading)
              set('callout_text', section.subheading)
              break
            case 'products':
              set('products_heading', section.heading)
              set('products', lines())
              break
            case 'projects':
              set('projects_heading', section.heading)
              await relate('relatedProjects', 'case_study_id', projects)
              break
            case 'how': {
              const match = /^(.*?)\s*\*\*(.+)\*\*\s*$/.exec(text(section.heading))
              set('process_heading', match ? match[1] : section.heading)
              if (match) set('process_highlight', match[2])
              set('process_cta_label', section.cta_label)
              set('process_cta_href', section.cta_href)
              set('process', lines())
              break
            }
            case 'faq':
              set('faq_heading', section.heading)
              await faqs(p.faqs)
              break
            default:
              continue
          }
        } else {
          switch (key) {
            case 'overview':
              if (await arrayEmpty('case_study_project_overview')) {
                filledArrays.add('case_study_project_overview')
                cards.forEach((card, index) => statements.push(`INSERT INTO "case_study_project_overview" ("_order", "_parent_id", "id", "label", "text") VALUES (${index + 1}, ${id}, ${q(newId())}, ${q(text(card.title))}, ${nul(card.short_description)})`))
              }
              break
            case 'glance':
              if (await arrayEmpty('case_study_glance_at_a_glance')) {
                filledArrays.add('case_study_glance_at_a_glance')
                cards.filter((card) => text(card.type) === 'stat' || !empty(card.value)).forEach((card, index) =>
                  statements.push(`INSERT INTO "case_study_glance_at_a_glance" ("_order", "_parent_id", "id", "label", "value") VALUES (${index + 1}, ${id}, ${q(newId())}, ${q(text(card.title))}, ${q(text(card.value))})`),
                )
              }
              break
            case 'features':
              set('features_heading', section.heading)
              set('features_intro', section.subheading)
              if (await arrayEmpty('case_study_features_items')) {
                filledArrays.add('case_study_features_items')
                cards.forEach((card, index) => statements.push(`INSERT INTO "case_study_features_items" ("_order", "_parent_id", "id", "text") VALUES (${index + 1}, ${id}, ${q(newId())}, ${q(text(card.title))})`))
              }
              break
            case 'specs-note':
              set('specs_heading', section.heading)
              set('specs_intro', section.subheading || plainText(section.body))
              break
            case 'spec':
              specs.push({ ...section, cards })
              break
            case 'gap':
              set('gap_heading', section.heading)
              if (await arrayEmpty('case_study_gap_cards')) {
                filledArrays.add('case_study_gap_cards')
                cards.forEach((card, index) => statements.push(`INSERT INTO "case_study_gap_cards" ("_order", "_parent_id", "id", "title", "text") VALUES (${index + 1}, ${id}, ${q(newId())}, ${q(text(card.title))}, ${nul(card.short_description)})`))
              }
              break
            default:
              continue
          }
        }
        converted.push(section)
      }

      if (stacks.length && (await arrayEmpty(p.stacks))) {
        stacks.forEach((stack, index) => {
          const cards = stack.cards as Row[]
          const kind = stack.type === 'marquee' ? 'logos' : stack.type === 'chips' ? 'chips' : stack.type === 'cards' ? 'cards' : 'rows'
          const items =
            kind === 'logos' || kind === 'chips'
              ? text(stack.tags)
              : kind === 'cards'
                ? cards.map((card) => line(card.title, card.short_description)).join('\n')
                : cards.map((card) => (empty(card.tags) ? text(card.title) : `${text(card.title)}: ${text(card.tags)}`)).join('\n')
          statements.push(
            `INSERT INTO "${p.stacks}" ("_order", "_parent_id", "id", "kind", "heading", "intro", "items", "note", "tinted") VALUES (${index + 1}, ${id}, ${q(newId())}, ${q(kind)}, ${nul(stack.heading)}, ${nul(stack.subheading)}, ${q(items)}, ${nul(plainText(stack.body))}, ${hasVariant(stack, 'surface') ? 1 : 0})`,
          )
        })
      }
      if (specs.length && (await arrayEmpty('case_study_specs_spec_groups'))) {
        specs.forEach((spec, index) => {
          const group = newId()
          statements.push(`INSERT INTO "case_study_specs_spec_groups" ("_order", "_parent_id", "id", "heading") VALUES (${index + 1}, ${id}, ${q(group)}, ${q(text(spec.heading) || `Specifications ${index + 1}`)})`)
          ;(spec.cards as Row[]).forEach((card, row) =>
            statements.push(
              `INSERT INTO "case_study_specs_spec_groups_rows" ("_order", "_parent_id", "id", "label", "value", "built_in") VALUES (${row + 1}, ${q(group)}, ${q(newId())}, ${q(text(card.title))}, ${nul(card.value)}, ${text(card.icon) === 'check' ? 1 : 0})`,
            ),
          )
        })
        converted.push(...specs)
      } else if (specs.length) {
        converted.push(...specs)
      }

      if (updates.size) statements.push(`UPDATE "${owner}" SET ${[...updates].map(([column, value]) => `"${column}" = ${value}`).join(', ')} WHERE "id" = ${id}`)
      if (converted.length) {
        statements.push(`DELETE FROM "${owner}_rels" WHERE "id" IN (${converted.map((section) => Number(section.rel_id)).join(', ')})`)
        const rels = unlinked.get(`${owner}_rels`) ?? new Set<number>()
        converted.forEach((section) => rels.add(Number(section.rel_id)))
        unlinked.set(`${owner}_rels`, rels)
        removed.push(...converted.map((section) => Number(section.id)))
        if (owner === 'case_study') changedProjects.push(id)
      }
    }
  }

  await convert('capability')
  await convert('industry')
  await convert('case_study')

  // Related lists that still name deleted documents.
  for (const section of await read(`SELECT "id", "type", "tags" FROM "section" WHERE "type" IN ('articles', 'projects') AND coalesce("tags", '') <> ''`)) {
    if (removed.includes(Number(section.id))) continue
    const ids = section.type === 'articles' ? posts : projects
    const slugs = slugsOf(section.tags)
    const kept = slugs.filter((slug) => ids.has(slug))
    if (kept.length !== slugs.length) statements.push(`UPDATE "section" SET "tags" = ${kept.length ? q(kept.join(', ')) : 'NULL'} WHERE "id" = ${Number(section.id)}`)
  }

  // Sections nothing links to any more: the ones moved above (unless another page also uses them) and leftovers of
  // deleted documents.
  const relTables = [...tables].filter((table) => table.endsWith('_rels'))
  const sectionRelTables: string[] = []
  for (const table of relTables) if ((await columnsOf(table)).has('section_id')) sectionRelTables.push(table)
  const linkedSections = new Set<number>()
  // Version links of the projects changed above go too: their versions are rebuilt from the new fields below.
  if (changedProjects.length && sectionRelTables.includes('_case_study_v_rels')) {
    const rows = await read(`SELECT r."id" FROM "_case_study_v_rels" r JOIN "_case_study_v" v ON v."id" = r."parent_id" WHERE v."parent_id" IN (${changedProjects.join(', ')})`)
    unlinked.set('_case_study_v_rels', new Set(rows.map((row) => Number(row.id))))
  }
  for (const table of sectionRelTables) {
    const gone = unlinked.get(table) ?? new Set<number>()
    for (const row of await read(`SELECT "id", "section_id" FROM "${table}" WHERE "section_id" IS NOT NULL`)) if (!gone.has(Number(row.id))) linkedSections.add(Number(row.section_id))
  }
  const deletable = (await read(`SELECT "id" FROM "section"`)).map((row) => Number(row.id)).filter((sectionId) => !linkedSections.has(sectionId))
  if (deletable.length) {
    const list = deletable.join(', ')
    const cards = (
      await read(
        `SELECT DISTINCT "card_id" AS id FROM "section_rels" WHERE "parent_id" IN (${list}) AND "card_id" IS NOT NULL AND "card_id" NOT IN (SELECT "card_id" FROM "section_rels" WHERE "parent_id" NOT IN (${list}) AND "card_id" IS NOT NULL)`,
      )
    ).map((row) => Number(row.id))
    for (const table of sectionRelTables) statements.push(`DELETE FROM "${table}" WHERE "section_id" IN (${list})`)
    statements.push(`DELETE FROM "section_rels" WHERE "parent_id" IN (${list})`)
    if (cards.length) statements.push(`DELETE FROM "card" WHERE "id" IN (${cards.join(', ')})`)
    statements.push(`DELETE FROM "section" WHERE "id" IN (${list})`)
  }

  if (changedProjects.length) statements.push(...(await buildVersionRepair(read, { replace: { case_study: changedProjects } })))
  return statements
}

export async function applySectionsToFields(db: MigrateUpArgs['db']): Promise<void> {
  const read: Reader = async (query) => (await db.all(sql.raw(query))) as Row[]
  for (const statement of await buildSectionsToFieldsSchema(read)) await db.run(sql.raw(statement))
  for (const statement of await buildSectionsToFields(read)) await db.run(sql.raw(statement))
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await applySectionsToFields(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  void db
}

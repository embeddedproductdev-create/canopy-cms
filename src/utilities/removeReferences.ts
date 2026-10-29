import { sql } from '@payloadcms/db-d1-sqlite'
import type { CollectionAfterDeleteHook, CollectionBeforeDeleteHook, PayloadRequest } from 'payload'

type Row = Record<string, unknown>
export type Reader = (query: string) => Promise<Row[]>
export type Referenced = 'blog' | 'case-study' | 'capability' | 'industry'

const TABLE: Record<Referenced, string> = { blog: 'blog', 'case-study': 'case_study', capability: 'capability', industry: 'industry' }
const URL_PREFIX: Record<Referenced, string> = { blog: '/insights/', 'case-study': '/work/', capability: '/capabilities/', industry: '/industries/' }
/** Section types that list documents by slug in `tags`. */
const SLUG_LIST_TYPE: Partial<Record<Referenced, string>> = { blog: 'articles', 'case-study': 'projects' }
/** Globals whose JSON columns hold menu links. */
const LINK_TABLES = ['header', 'footer', 'site_chrome']

const q = (value: string) => `'${value.replace(/'/g, "''")}'`
const tablesWithColumn = async (read: Reader, column: string) =>
  (
    await read(
      `SELECT m.name AS t FROM sqlite_master m JOIN pragma_table_info(m.name) p WHERE m.type = 'table' AND m.name NOT LIKE 'sqlite_%' AND m.name NOT LIKE '_cf_%' AND p.name = ${q(column)}`,
    )
  ).map((row) => String(row.t))

/** Sections the document shows on its own page, read before the delete removes the links to them. */
export async function ownSectionIds(read: Reader, collection: Referenced, id: number): Promise<number[]> {
  const rows = await read(`SELECT DISTINCT "section_id" AS id FROM "${TABLE[collection]}_rels" WHERE "parent_id" = ${Number(id)} AND "path" LIKE '%layoutSections' AND "section_id" IS NOT NULL`)
  return rows.map((row) => Number(row.id))
}

function withoutLink(value: unknown, urls: Set<string>): unknown {
  if (Array.isArray(value)) {
    return value.filter((item) => !(item && typeof item === 'object' && [(item as Row).url, (item as Row).href].some((link) => typeof link === 'string' && urls.has(link)))).map((item) => withoutLink(item, urls))
  }
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, withoutLink(item, urls)]))
  return value
}

/**
 * Statements that remove every reference to a deleted document, so no page keeps showing it: relationship rows,
 * slugs in related-article/project sections, buttons and cards that link to its page, menu links, and the
 * sections that only the deleted document used.
 */
export async function buildRemoveReferences(read: Reader, target: { collection: Referenced; id: number; slug: string; ownSections: number[] }): Promise<string[]> {
  const { collection, id, slug } = target
  const statements: string[] = []
  const url = `${URL_PREFIX[collection]}${slug}/`
  const urls = new Set([url, url.slice(0, -1)])
  const inUrls = [...urls].map(q).join(', ')

  for (const table of await tablesWithColumn(read, `${TABLE[collection]}_id`)) {
    if (table.endsWith('_rels')) statements.push(`DELETE FROM "${table}" WHERE "${TABLE[collection]}_id" = ${Number(id)}`)
  }

  const listType = SLUG_LIST_TYPE[collection]
  if (listType && slug) {
    for (const row of await read(`SELECT "id", "tags" FROM "section" WHERE "type" = ${q(listType)} AND "tags" LIKE ${q(`%${slug}%`)}`)) {
      const items = String(row.tags).split(',').map((item) => item.trim()).filter(Boolean)
      const kept = items.filter((item) => item !== slug)
      if (kept.length !== items.length) statements.push(`UPDATE "section" SET "tags" = ${kept.length ? q(kept.join(', ')) : 'NULL'} WHERE "id" = ${Number(row.id)}`)
    }
  }

  if (slug) {
    statements.push(`UPDATE "section" SET "cta_label" = NULL, "cta_href" = NULL WHERE "cta_href" IN (${inUrls})`)
    statements.push(`UPDATE "section" SET "secondary_cta_label" = NULL, "secondary_cta_href" = NULL WHERE "secondary_cta_href" IN (${inUrls})`)
    const linkCards = (await read(`SELECT "id" FROM "card" WHERE "cta_url" IN (${inUrls})`)).map((row) => Number(row.id))
    if (linkCards.length) statements.push(`DELETE FROM "section_rels" WHERE "card_id" IN (${linkCards.join(', ')})`, `DELETE FROM "card" WHERE "id" IN (${linkCards.join(', ')})`)

    for (const table of LINK_TABLES) {
      const columns = (await read(`SELECT "name" FROM pragma_table_info(${q(table)})`)).map((row) => String(row.name))
      for (const column of columns) {
        for (const row of await read(`SELECT "id", "${column}" AS v FROM "${table}" WHERE typeof("${column}") = 'text' AND "${column}" LIKE ${q(`%${url.slice(0, -1)}%`)}`)) {
          try {
            const next = JSON.stringify(withoutLink(JSON.parse(String(row.v)), urls))
            if (next !== row.v) statements.push(`UPDATE "${table}" SET "${column}" = ${q(next)} WHERE "id" = ${Number(row.id)}`)
          } catch {
            // Not JSON: plain text that only mentions the URL is left as it is.
          }
        }
      }
    }
  }

  // The deleted document's own sections, unless another page still shows them.
  if (target.ownSections.length) {
    const ids = target.ownSections.map(Number).join(', ')
    const owners = (await tablesWithColumn(read, 'section_id')).filter((table) => table.endsWith('_rels') && !table.startsWith('_'))
    const shared = new Set<number>()
    for (const table of owners) {
      const self = table === `${TABLE[collection]}_rels` ? ` AND "parent_id" <> ${Number(id)}` : ''
      for (const row of await read(`SELECT DISTINCT "section_id" AS id FROM "${table}" WHERE "section_id" IN (${ids})${self}`)) shared.add(Number(row.id))
    }
    const unused = target.ownSections.filter((section) => !shared.has(section))
    if (unused.length) {
      const list = unused.join(', ')
      const cards = (await read(`SELECT DISTINCT "card_id" AS id FROM "section_rels" WHERE "parent_id" IN (${list}) AND "card_id" IS NOT NULL AND "card_id" NOT IN (SELECT "card_id" FROM "section_rels" WHERE "parent_id" NOT IN (${list}) AND "card_id" IS NOT NULL)`)).map((row) => Number(row.id))
      for (const table of await tablesWithColumn(read, 'section_id')) if (table.endsWith('_rels')) statements.push(`DELETE FROM "${table}" WHERE "section_id" IN (${list})`)
      statements.push(`DELETE FROM "section_rels" WHERE "parent_id" IN (${list})`)
      if (cards.length) statements.push(`DELETE FROM "card" WHERE "id" IN (${cards.join(', ')})`)
      statements.push(`DELETE FROM "section" WHERE "id" IN (${list})`)
    }
  }
  return statements
}

type Db = { all: (query: unknown) => Promise<unknown[]>; run: (query: unknown) => Promise<unknown> }

async function dbFor(req: PayloadRequest): Promise<Db> {
  const adapter = req.payload.db as unknown as { drizzle: Db; sessions?: Record<string, { db: Db }> }
  const transaction = req.transactionID ? await req.transactionID : undefined
  return (transaction && adapter.sessions?.[String(transaction)]?.db) || adapter.drizzle
}

const OWN_SECTIONS = 'removeReferences.ownSections'

export function captureOwnSections(collection: Referenced): CollectionBeforeDeleteHook {
  return async ({ req, id }) => {
    const db = await dbFor(req)
    const read: Reader = async (query) => (await db.all(sql.raw(query))) as Row[]
    req.context[`${OWN_SECTIONS}.${collection}.${id}`] = await ownSectionIds(read, collection, Number(id))
  }
}

export function removeReferences(collection: Referenced): CollectionAfterDeleteHook {
  const removeReferencesHook: CollectionAfterDeleteHook = async ({ req, id, doc }) => {
    const db = await dbFor(req)
    const read: Reader = async (query) => (await db.all(sql.raw(query))) as Row[]
    const ownSections = (req.context[`${OWN_SECTIONS}.${collection}.${id}`] as number[] | undefined) ?? []
    const slug = typeof (doc as Row)?.slug === 'string' ? String((doc as Row).slug) : ''
    for (const statement of await buildRemoveReferences(read, { collection, id: Number(id), slug, ownSections })) await db.run(sql.raw(statement))
    return doc
  }
  return removeReferencesHook
}

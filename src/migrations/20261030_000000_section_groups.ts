import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-d1-sqlite'
import { sql } from '@payloadcms/db-d1-sqlite'

/**
 * Moves Capability, Portfolio and Insight fields into Payload group fields (hero, scope, project, ...).
 * Payload stores a group's fields as `<group>_<field>` columns, group arrays as `<table>_<group>_<array>`
 * tables and group relationships under a `<group>.<field>` path, so this renames exactly those things
 * and leaves every value untouched. It is safe to run twice: anything already renamed is skipped.
 */

type Kind = 'column' | 'array' | 'relation'
type GroupSpec = { group: string; fields: { name: string; kind: Kind }[] }
type CollectionSpec = {
  /** Main table, e.g. "capability". */
  table: string
  /** Draft versions: `_case_study_v` holds `version_*` columns, `_case_study_v_version_*` array tables. */
  versions?: string
  groups: GroupSpec[]
}

export type Schema = { tables: Record<string, string[]> }

const col = (name: string) => ({ name, kind: 'column' as const })
const arr = (name: string) => ({ name, kind: 'array' as const })
const rel = (name: string) => ({ name, kind: 'relation' as const })

export const sectionGroups: CollectionSpec[] = [
  {
    table: 'capability',
    groups: [
      { group: 'hero', fields: ['eyebrow', 'heading', 'subheading', 'summary', 'cta', 'secondaryCta', 'image', 'imageAlt'].map(col) },
      { group: 'scope', fields: [col('includedHeading'), arr('included'), col('whyHeading'), col('whyText')] },
      { group: 'technology', fields: [arr('stacks')] },
      { group: 'process', fields: ['workflowEyebrow', 'workflowHeading', 'workflowIntro', 'workflow'].map(col) },
      { group: 'related', fields: [col('projectsHeading'), rel('relatedProjects'), col('insightsHeading'), rel('relatedInsights')] },
      { group: 'faq', fields: [col('faqHeading'), arr('faqs')] },
    ],
  },
  {
    table: 'case_study',
    versions: '_case_study_v',
    groups: [
      { group: 'project', fields: [...['heading', 'subheading', 'category', 'featured', 'projectStage', 'tags'].map(col), arr('overview')] },
      { group: 'glance', fields: [arr('atAGlance')] },
      { group: 'specs', fields: [arr('specGroups')] },
      { group: 'content', fields: [col('body')] },
    ],
  },
  {
    table: 'blog',
    versions: '_blog_v',
    groups: [
      { group: 'article', fields: ['category', 'featured', 'teaser', 'byline', 'publishedAt', 'tags'].map(col) },
      { group: 'cover', fields: [col('image')] },
    ],
  },
]

const snake = (value: string) => value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)

/** Plain function over a schema snapshot so it can be checked without a database. */
export function groupStatements(schema: Schema, spec: CollectionSpec[] = sectionGroups): string[] {
  const statements: string[] = []
  const tables = new Map(Object.entries(schema.tables).map(([name, columns]) => [name, [...columns]]))

  const renameColumn = (table: string, from: string, to: string) => {
    const columns = tables.get(table)
    if (!columns?.includes(from) || columns.includes(to)) return
    columns[columns.indexOf(from)] = to
    statements.push(`ALTER TABLE "${table}" RENAME COLUMN "${from}" TO "${to}"`)
  }
  const renameTable = (from: string, to: string) => {
    if (!tables.has(from) || tables.has(to)) return
    tables.set(to, tables.get(from)!)
    tables.delete(from)
    statements.push(`ALTER TABLE "${from}" RENAME TO "${to}"`)
  }

  for (const collection of spec) {
    // [table holding columns, column prefix, array-table prefix, relation path prefix]
    const targets: [string, string, string, string][] = [[collection.table, '', collection.table, '']]
    if (collection.versions) targets.push([collection.versions, 'version_', `${collection.versions}_version`, 'version.'])

    for (const [table, columnPrefix, tablePrefix, pathPrefix] of targets) {
      if (!tables.has(table)) continue
      for (const { group, fields } of collection.groups) {
        for (const field of fields) {
          const name = snake(field.name)
          if (field.kind === 'column') {
            for (const column of [...(tables.get(table) ?? [])]) {
              const own = `${columnPrefix}${name}`
              if (column === own || column.startsWith(`${own}_`)) {
                renameColumn(table, column, `${columnPrefix}${group}_${column.slice(columnPrefix.length)}`)
              }
            }
          } else if (field.kind === 'array') {
            for (const existing of [...tables.keys()]) {
              const own = `${tablePrefix}_${name}`
              if (existing === own || existing.startsWith(`${own}_`)) {
                renameTable(existing, `${tablePrefix}_${group}_${existing.slice(tablePrefix.length + 1)}`)
              }
            }
          } else {
            const relTable = `${table}_rels`
            if (tables.has(relTable)) {
              statements.push(
                `UPDATE "${relTable}" SET "path" = '${pathPrefix}${group}.' || "path" WHERE "path" = '${pathPrefix}${field.name}' OR "path" LIKE '${pathPrefix}${field.name}.%'`,
              )
            }
          }
        }
      }
    }
  }
  return statements
}

type Row = Record<string, unknown>
export type Reader = (query: string) => Promise<Row[]>

export async function buildSectionGroups(read: Reader): Promise<string[]> {
  // Only the tables we may rename: D1's own `_cf_*` tables refuse PRAGMA table_info.
  const relevant = new RegExp(`^(${sectionGroups.flatMap((entry) => [entry.table, entry.versions].filter(Boolean)).join('|')})(_|$)`)
  const names = (await read(`SELECT name FROM sqlite_master WHERE type = 'table'`)).map((row) => String(row.name)).filter((name) => relevant.test(name))
  const schema: Schema = { tables: {} }
  for (const name of names) {
    schema.tables[name] = (await read(`SELECT name FROM pragma_table_info('${name}')`)).map((column) => String(column.name))
  }
  return groupStatements(schema)
}

export async function applySectionGroups(db: MigrateUpArgs['db']): Promise<void> {
  const read: Reader = async (query) => (await db.all(sql.raw(query))) as Row[]
  for (const statement of await buildSectionGroups(read)) await db.run(sql.raw(statement))
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await applySectionGroups(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  void db
}

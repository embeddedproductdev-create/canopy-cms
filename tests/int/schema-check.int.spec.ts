import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { getPayload } from 'payload'
import { getTableConfig } from 'drizzle-orm/sqlite-core'
import { describe, expect, it } from 'vitest'
import config from '@/payload.config'
import { findSchemaGaps, type ActualColumn } from '../../scripts/lib/schema-check'
import { buildBlogMarkdownContent } from '../../src/migrations/20261028_000000_blog_markdown_content'
import { buildHeroImageFit } from '../../src/migrations/20261029_000000_hero_image_fit'
import { buildSectionGroups } from '../../src/migrations/20261030_000000_section_groups'
import { buildPayload392Columns } from '../../src/migrations/20261031_000000_payload_3_92_columns'
import { buildFormSubmissionPhone } from '../../src/migrations/20261101_000000_form_submission_phone'
import { buildSectionsToFieldsSchema } from '../../src/migrations/20261102_000000_sections_to_fields'
import { buildCapabilityBreadcrumbsSchema } from '../../src/migrations/20261103_000000_capability_breadcrumbs'
import { buildMediaObjectkeyColumn } from '../../src/migrations/20261105_000000_media_objectkey_column'
import expected from '../../scripts/lib/expected-schema.json'
import { STORAGE_COLUMNS } from '../../scripts/lib/storage-columns'

const expectedSchema = expected as Record<string, string[]>
const seed = fs.readFileSync(path.resolve('seed/db-dump.sql'), 'utf8')

const actualOf = (db: DatabaseSync): ActualColumn[] =>
  db
    .prepare(
      "SELECT m.name AS t, p.name AS c FROM sqlite_master m, pragma_table_info(m.name) p WHERE m.type = 'table' AND m.name NOT LIKE 'sqlite_%' AND m.name NOT LIKE '_cf_%'",
    )
    .all() as unknown as ActualColumn[]

describe('database schema check', () => {
  it('matches what Payload expects, so a stale expected-schema.json is caught', async () => {
    const payload = await getPayload({ config: await config })
    const tables = payload.db.tables as unknown as Record<string, Parameters<typeof getTableConfig>[0]>
    const current = Object.fromEntries(
      Object.values(tables).map((table) => {
        const { name, columns } = getTableConfig(table)
        return [name, [...columns.map((column) => column.name), ...(STORAGE_COLUMNS[name] ?? [])]]
      }),
    )
    const sort = (value: Record<string, string[]>) => Object.fromEntries(Object.entries(value).sort().map(([table, columns]) => [table, [...columns].sort()]))
    expect(sort(expectedSchema)).toEqual(sort(current))
  })

  it('reports the missing tables and columns of a database that still has the old content layout', () => {
    const db = new DatabaseSync(':memory:')
    db.exec(seed)
    const gaps = findSchemaGaps(expectedSchema, actualOf(db))
    expect(gaps.length).toBeGreaterThan(0)
    expect(gaps.join('\n')).toContain('case_study.project_heading')
    expect(gaps.join('\n')).toContain('capability.hero_heading')
  })

  it('finds nothing missing once the newest migrations have been applied to the seed', async () => {
    const db = new DatabaseSync(':memory:')
    db.exec(seed)
    const read = async (query: string) => db.prepare(query).all() as Record<string, unknown>[]
    for (const build of [buildBlogMarkdownContent, buildHeroImageFit, buildSectionGroups, buildPayload392Columns, buildFormSubmissionPhone, buildSectionsToFieldsSchema, buildCapabilityBreadcrumbsSchema, buildMediaObjectkeyColumn]) {
      for (const statement of await build(read)) db.exec(statement)
    }
    expect(findSchemaGaps(expectedSchema, actualOf(db))).toEqual([])
  })

  it('ignores extra tables and columns the database has but Payload no longer uses', () => {
    expect(findSchemaGaps({ a: ['x'] }, [{ t: 'a', c: 'x' }, { t: 'a', c: 'old' }, { t: 'legacy', c: 'z' }])).toEqual([])
    expect(findSchemaGaps({ a: ['x', 'y'], b: ['q'] }, [{ t: 'a', c: 'x' }])).toEqual(['a.y', 'table b'])
  })
})

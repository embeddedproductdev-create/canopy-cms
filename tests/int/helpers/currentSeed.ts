import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { buildBlogMarkdownContent } from '../../../src/migrations/20261028_000000_blog_markdown_content'
import { buildHeroImageFit } from '../../../src/migrations/20261029_000000_hero_image_fit'
import { buildSectionGroups } from '../../../src/migrations/20261030_000000_section_groups'
import { buildPayload392Columns } from '../../../src/migrations/20261031_000000_payload_3_92_columns'
import { buildFormSubmissionPhone } from '../../../src/migrations/20261101_000000_form_submission_phone'

export type Row = Record<string, unknown>

/** seed/db-dump.sql with every migration the seed predates applied, i.e. the schema the live database has. */
export async function currentSeed(): Promise<{ db: DatabaseSync; read: (query: string) => Promise<Row[]>; all: (query: string) => Row[] }> {
  const db = new DatabaseSync(':memory:')
  db.exec(fs.readFileSync(path.resolve('seed/db-dump.sql'), 'utf8'))
  const all = (query: string) => db.prepare(query).all() as Row[]
  const read = async (query: string) => all(query)
  for (const build of [buildBlogMarkdownContent, buildHeroImageFit, buildSectionGroups, buildPayload392Columns, buildFormSubmissionPhone]) {
    for (const statement of await build(read)) db.exec(statement)
  }
  return { db, read, all }
}

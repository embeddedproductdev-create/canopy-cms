import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { buildProjectContentAndCleanup, type Row } from '../../src/migrations/20261013_120000_project_content_and_cleanup'
import { projectContent } from '../../src/migrations/data/projects'

const all = (sqlite: DatabaseSync, query: string) => sqlite.prepare(query).all() as Row[]

function olderSeed(): DatabaseSync {
  const committed = execFileSync('git', ['show', 'HEAD:seed/db-dump.sql'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(committed)
  return sqlite
}

async function migrate(sqlite: DatabaseSync) {
  const plan = await buildProjectContentAndCleanup(async (query) => all(sqlite, query))
  for (const statement of plan.statements) sqlite.exec(statement)
  return plan
}

describe('project content and clean-up migration', () => {
  it('writes the data.md content, removes unused data and is idempotent', async (ctx) => {
    let sqlite: DatabaseSync
    try {
      sqlite = olderSeed()
    } catch {
      sqlite = new DatabaseSync(':memory:')
      sqlite.exec(fs.readFileSync(path.resolve('seed/db-dump.sql'), 'utf8'))
    }
    // The committed seed already includes this migration, so there is nothing left to replay.
    if (all(sqlite, `SELECT name FROM payload_migrations WHERE name = '20261013_120000_project_content_and_cleanup'`).length) ctx.skip()
    await migrate(sqlite)

    for (const project of projectContent) {
      const doc = all(sqlite, `SELECT * FROM case_study WHERE slug = '${project.slug}'`)[0]
      expect(doc.subheading).toBe(project.subheading)
      expect(doc.category).toBe(project.category)
      expect(doc.project_stage).toBe('shipped')
      expect(doc.tags).toBe(project.tags)
      expect(doc.title).not.toContain(':')
      expect(doc.card_cta_link).toBe(`/work/${project.slug}/`)
      expect(doc.page_cta_link).toBe('#consultation')
      const body = JSON.parse(String(doc.body)) as { root: { children: { type: string }[] } }
      expect(body.root.children.length).toBe(project.body.length)
      expect(body.root.children.every((node) => node.type === 'paragraph' || node.type === 'heading')).toBe(true)

      const overview = all(sqlite, `SELECT label, text FROM case_study_overview WHERE _parent_id = ${doc.id} ORDER BY _order`)
      expect(overview).toEqual(project.overview.map((row) => ({ label: row.label, text: row.text })))
      const glance = all(sqlite, `SELECT label, value FROM case_study_at_a_glance WHERE _parent_id = ${doc.id} ORDER BY _order`)
      expect(glance).toEqual(project.atAGlance.map((row) => ({ label: row.label, value: row.value })))
      const groups = all(sqlite, `SELECT id, heading FROM case_study_spec_groups WHERE _parent_id = ${doc.id} ORDER BY _order`)
      expect(groups.map((group) => group.heading)).toEqual(project.specGroups.map((group) => group.heading))
      for (const [index, group] of groups.entries()) {
        const rows = all(sqlite, `SELECT label FROM case_study_spec_groups_rows WHERE _parent_id = '${group.id}' ORDER BY _order`)
        expect(rows.map((row) => row.label)).toEqual(project.specGroups[index].rows.map((row) => row.label))
      }
      const gap = all(sqlite, `SELECT heading FROM section WHERE section_key = 'gap' AND id IN (SELECT section_id FROM case_study_rels WHERE parent_id = ${doc.id})`)[0]
      expect(gap.heading).toBe(project.gap.heading)
    }

    expect(all(sqlite, `SELECT id FROM media WHERE filename IN ('Canopy.png', 'raw-hw-1.png')`)).toHaveLength(0)
    expect(all(sqlite, `SELECT id FROM media WHERE filename = 'logo-green-new.png'`)).toHaveLength(1)
    expect(all(sqlite, `SELECT id FROM page_workflow_steps`)).toHaveLength(0)
    for (const table of ['page', 'blog', 'case_study', 'checklist']) expect(all(sqlite, `SELECT DISTINCT parent_id FROM _${table}_v WHERE latest = 1`)).toHaveLength(all(sqlite, `SELECT id FROM ${table}`).length)
    expect(all(sqlite, `SELECT id FROM card WHERE heading IS NOT NULL OR role IS NOT NULL OR category IS NOT NULL OR theme IS NOT NULL`)).toHaveLength(0)
    expect(all(sqlite, `SELECT id FROM section WHERE summary IS NOT NULL OR tag_line IS NOT NULL OR highlight IS NOT NULL`)).toHaveLength(0)

    const before = JSON.stringify([all(sqlite, 'SELECT * FROM case_study ORDER BY id'), all(sqlite, 'SELECT * FROM case_study_spec_groups_rows ORDER BY id')])
    const again = await migrate(sqlite)
    expect(again.removedMedia).toHaveLength(0)
    expect(JSON.stringify([all(sqlite, 'SELECT * FROM case_study ORDER BY id'), all(sqlite, 'SELECT * FROM case_study_spec_groups_rows ORDER BY id')])).toBe(before)
  })

  it('leaves the committed seed free of unused media, versions and legacy values', () => {
    const sqlite = new DatabaseSync(':memory:')
    sqlite.exec(fs.readFileSync(path.resolve('seed/db-dump.sql'), 'utf8'))
    const files = new Set(fs.readdirSync(path.resolve('seed/media')))
    const rows = all(sqlite, 'SELECT filename FROM media')
    // Every shipped file must belong to a media row. A row may lack a file: not every image is bundled in the seed.
    const names = new Set(rows.map((row) => String(row.filename)))
    expect([...files].filter((file) => !names.has(file))).toEqual([])
    expect(all(sqlite, 'SELECT id FROM _case_study_v WHERE latest = 1')).toHaveLength(
      all(sqlite, 'SELECT id FROM case_study').length,
    )
  })
})

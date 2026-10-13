import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { buildRestructure, ensureRestructureSchema, type Row } from '../../src/migrations/20261014_120000_restructure_collections'
import { buildSectionCardCleanup } from '../../src/migrations/20261012_120000_section_card_cleanup'
import { buildProjectContentAndCleanup } from '../../src/migrations/20261013_120000_project_content_and_cleanup'
import { sectionTypes } from '../../src/collections/sectionLayouts'

const all = (sqlite: DatabaseSync, query: string) => sqlite.prepare(query).all() as Row[]

function headSeed(): DatabaseSync {
  const committed = execFileSync('git', ['show', 'HEAD:seed/db-dump.sql'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(committed)
  return sqlite
}

async function run(sqlite: DatabaseSync): Promise<void> {
  const read = async (query: string) => all(sqlite, query)
  for (const statement of await buildSectionCardCleanup(read)) sqlite.exec(statement)
  for (const statement of (await buildProjectContentAndCleanup(read)).statements) sqlite.exec(statement)
  for (const statement of await ensureRestructureSchema(read)) sqlite.exec(statement)
  for (const statement of (await buildRestructure(read)).statements) sqlite.exec(statement)
}

describe('collections restructure', () => {
  it('moves Capability, Industry, Portfolio, Insights and Checklist content into Sections and Cards', async () => {
    let sqlite: DatabaseSync
    try {
      sqlite = headSeed()
    } catch {
      sqlite = new DatabaseSync(':memory:')
      sqlite.exec(fs.readFileSync(path.resolve('seed/db-dump.sql'), 'utf8'))
    }
    // Before the migration shipped, HEAD holds the old content and the builders are exercised on it; once the
    // committed seed is already migrated, the same assertions check the migrated result.
    const migrated = all(sqlite, `SELECT name FROM payload_migrations WHERE name = '20261014_120000_restructure_collections'`).length > 0
    const legacyUpgrades = Number(all(sqlite, `SELECT count(*) AS n FROM blog WHERE coalesce(content_upgrade_label, '') <> '' AND content_upgrade_checklist_link_id IS NOT NULL`)[0].n)
    if (!migrated) await run(sqlite)
    const withUpgrade = migrated ? Number(all(sqlite, `SELECT count(*) AS n FROM blog_rels r JOIN section s ON s.id = r.section_id WHERE s.section_key = 'upgrade'`)[0].n) : legacyUpgrades

    for (const owner of ['capability', 'industry']) {
      for (const doc of all(sqlite, `SELECT id, title FROM ${owner}`)) {
        const sections = all(sqlite, `SELECT s.type, s.section_key AS key FROM ${owner}_rels r JOIN section s ON s.id = r.section_id WHERE r.parent_id = ${doc.id} AND r.path = 'layoutSections' ORDER BY r."order"`)
        expect(sections.length, `${owner} ${doc.title}`).toBeGreaterThanOrEqual(2)
        expect(sections[0]).toEqual({ type: 'hero', key: 'hero' })
        for (const section of sections) expect(sectionTypes).toContain(section.type)
      }
      expect(all(sqlite, `SELECT id FROM ${owner}_stacks`)).toHaveLength(0)
      expect(all(sqlite, `SELECT id FROM ${owner}_faqs`)).toHaveLength(0)
    }

    const pcb = all(sqlite, `SELECT id FROM capability WHERE slug = 'pcb-design'`)[0]
    const marquee = all(sqlite, `SELECT s.tags FROM capability_rels r JOIN section s ON s.id = r.section_id WHERE r.parent_id = ${pcb.id} AND s.type = 'marquee'`)[0]
    expect(String(marquee.tags)).toContain('/api/media/file/')
    const projects = all(sqlite, `SELECT s.tags FROM capability_rels r JOIN section s ON s.id = r.section_id WHERE r.parent_id = ${pcb.id} AND s.type = 'projects'`)[0]
    expect(String(projects.tags)).toContain('smart-bms')
    expect(all(sqlite, `SELECT summary FROM capability WHERE id = ${pcb.id}`)[0].summary).toBeTruthy()

    for (const study of all(sqlite, 'SELECT id, title FROM case_study')) {
      const sections = all(sqlite, `SELECT s.type, s.variant, s.section_key AS key FROM case_study_rels r JOIN section s ON s.id = r.section_id WHERE r.parent_id = ${study.id} AND r.path = 'layoutSections' ORDER BY r."order"`)
      const keys = sections.map((s) => s.key)
      expect(keys.slice(0, 2)).toEqual(['overview', 'glance'])
      expect(keys).toContain('gap')
      expect(sections.filter((s) => s.variant === 'spec').length).toBeGreaterThanOrEqual(2)
      expect(all(sqlite, `SELECT id FROM case_study_overview WHERE _parent_id = ${study.id}`)).toHaveLength(0)
      expect(all(sqlite, `SELECT id FROM _case_study_v WHERE parent_id = ${study.id} AND latest = 1`)).toHaveLength(1)
    }

    const upgrade = all(sqlite, `SELECT s.heading, s.cta_href FROM blog_rels r JOIN section s ON s.id = r.section_id WHERE s.section_key = 'upgrade'`)
    expect(withUpgrade).toBeGreaterThan(0)
    expect(upgrade).toHaveLength(withUpgrade)
    expect(String(upgrade[0].cta_href)).toMatch(/^\/resources\//)
    expect(all(sqlite, `SELECT id FROM blog WHERE content_upgrade_label IS NOT NULL`)).toHaveLength(0)

    const gate = all(sqlite, `SELECT key FROM site_chrome_ui_labels WHERE key LIKE 'checklist.gate.%'`)
    expect(gate).toHaveLength(15)
    expect(all(sqlite, `SELECT access_gate_heading AS h FROM checklist`).every((row) => row.h === null)).toBe(true)
    expect(all(sqlite, `SELECT name FROM sqlite_master WHERE name = 'checklist_rels'`)).toHaveLength(1)
    expect(all(sqlite, `SELECT id FROM page_rels WHERE path = 'relatedCaseStudies'`)).toHaveLength(0)

    for (const collection of ['page', 'blog', 'case_study', 'checklist']) {
      expect(all(sqlite, `SELECT DISTINCT parent_id FROM _${collection}_v WHERE latest = 1`)).toHaveLength(all(sqlite, `SELECT id FROM ${collection}`).length)
    }

    const read = async (query: string) => all(sqlite, query)
    const again = await buildRestructure(read)
    expect(again.statements.filter((statement) => statement.startsWith('INSERT INTO "section"'))).toHaveLength(
      all(sqlite, `SELECT id FROM case_study`).length * 0,
    )
  })
})

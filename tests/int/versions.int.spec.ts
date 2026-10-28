import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { buildVersionRepair, VERSIONED_COLLECTIONS } from '../../src/utilities/versionRepair'
import type { Row } from '../../src/migrations/20261012_120000_section_card_cleanup'

const all = (sqlite: DatabaseSync, query: string) => sqlite.prepare(query).all() as Row[]

function seed(): DatabaseSync {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(fs.readFileSync(path.resolve('seed/db-dump.sql'), 'utf8'))
  return sqlite
}

async function repair(sqlite: DatabaseSync): Promise<string[]> {
  const statements = await buildVersionRepair(async (query) => all(sqlite, query))
  for (const statement of statements) sqlite.exec(statement)
  return statements
}

describe('draft versions', () => {
  it('keeps one latest version for every Page, Portfolio, Insight and Checklist in the seed', () => {
    const sqlite = seed()
    for (const collection of VERSIONED_COLLECTIONS) {
      const docs = all(sqlite, `SELECT id FROM "${collection}"`).length
      const latest = all(sqlite, `SELECT DISTINCT parent_id FROM "_${collection}_v" WHERE latest = 1`).length
      expect(docs).toBeGreaterThan(0)
      expect(latest).toBe(docs)
    }
  })

  it('rebuilds missing versions (the admin lists read them) with children and relations', async () => {
    const sqlite = seed()
    const caseStudyId = Number(all(sqlite, `SELECT id FROM case_study WHERE slug = 'smart-bms'`)[0].id)
    const checklistId = Number(all(sqlite, `SELECT id FROM checklist WHERE slug = 'hardware-audit-checklist'`)[0].id)
    const before = {
      overview: all(sqlite, `SELECT label, text FROM case_study_overview WHERE _parent_id = ${caseStudyId} ORDER BY _order`),
      rows: all(sqlite, `SELECT r.label, r.value FROM case_study_spec_groups_rows r JOIN case_study_spec_groups g ON g.id = r._parent_id WHERE g._parent_id = ${caseStudyId} ORDER BY g._order, r._order`),
      sections: all(sqlite, `SELECT section_id FROM case_study_rels WHERE parent_id = ${caseStudyId} AND path = 'layoutSections' ORDER BY "order"`),
      items: all(sqlite, `SELECT number, heading, locked FROM checklist_items WHERE _parent_id = ${checklistId} ORDER BY _order`),
    }
    for (const collection of VERSIONED_COLLECTIONS) {
      if (all(sqlite, `SELECT name FROM sqlite_master WHERE name = '_${collection}_v_rels'`).length) sqlite.exec(`DELETE FROM "_${collection}_v_rels"`)
    }
    sqlite.exec(`DELETE FROM _case_study_v_version_spec_groups_rows; DELETE FROM _case_study_v_version_spec_groups; DELETE FROM _case_study_v_version_overview; DELETE FROM _case_study_v_version_at_a_glance; DELETE FROM _case_study_v; DELETE FROM _page_v_version_pills; DELETE FROM _page_v; DELETE FROM _checklist_v_version_visible_items; DELETE FROM _checklist_v_version_items; DELETE FROM _checklist_v; DELETE FROM _blog_v;`)

    const statements = await repair(sqlite)
    expect(statements.length).toBeGreaterThan(0)

    for (const collection of VERSIONED_COLLECTIONS) {
      const docs = all(sqlite, `SELECT id FROM "${collection}"`).length
      expect(all(sqlite, `SELECT id FROM "_${collection}_v" WHERE latest = 1`)).toHaveLength(docs)
    }
    const version = all(sqlite, `SELECT id, version__status AS status, version_title AS title FROM _case_study_v WHERE parent_id = ${caseStudyId} AND latest = 1`)[0]
    expect(version.status).toBe('published')
    expect(all(sqlite, `SELECT label, text FROM _case_study_v_version_overview WHERE _parent_id = ${version.id} ORDER BY _order`)).toEqual(before.overview)
    expect(
      all(
        sqlite,
        `SELECT r.label, r.value FROM _case_study_v_version_spec_groups_rows r JOIN _case_study_v_version_spec_groups g ON g.id = r._parent_id WHERE g._parent_id = ${version.id} ORDER BY g._order, r._order`,
      ),
    ).toEqual(before.rows)
    expect(all(sqlite, `SELECT section_id FROM _case_study_v_rels WHERE parent_id = ${version.id} AND path = 'version.layoutSections' ORDER BY "order"`)).toEqual(before.sections)
    const checklistVersion = all(sqlite, `SELECT id FROM _checklist_v WHERE parent_id = ${checklistId} AND latest = 1`)[0]
    expect(all(sqlite, `SELECT number, heading, locked FROM _checklist_v_version_items WHERE _parent_id = ${checklistVersion.id} ORDER BY _order`)).toEqual(before.items)

    const again = await repair(sqlite)
    expect(again).toHaveLength(0)
  })
})

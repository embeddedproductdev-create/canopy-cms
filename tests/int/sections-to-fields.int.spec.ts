import { describe, expect, it } from 'vitest'
import { buildSectionsToFields, buildSectionsToFieldsSchema } from '../../src/migrations/20261102_000000_sections_to_fields'
import { currentSeed, type Row } from './helpers/currentSeed'

async function migrated(prepare?: (exec: (statement: string) => void, all: (query: string) => Row[]) => void) {
  const seed = await currentSeed()
  for (const statement of await buildSectionsToFieldsSchema(seed.read)) seed.db.exec(statement)
  const exec = (statement: string) => seed.db.exec(statement)
  // What every section held before the move, so the fields can be compared with it.
  const sectionsOf = (owner: string, id: number) =>
    seed.all(`SELECT s.*, r."order" AS ord FROM "${owner}_rels" r JOIN section s ON s.id = r.section_id WHERE r.parent_id = ${id} AND r.path = 'layoutSections' ORDER BY r."order"`)
  const cardsOf = (sectionId: unknown) => seed.all(`SELECT c.* FROM section_rels r JOIN card c ON c.id = r.card_id WHERE r.parent_id = ${Number(sectionId)} AND r.path = 'cards' ORDER BY r."order"`)
  const before = { sectionsOf, cardsOf, snapshot: new Map<string, { section: Row; cards: Row[] }[]>() }
  for (const owner of ['capability', 'industry', 'case_study']) {
    for (const doc of seed.all(`SELECT id FROM ${owner}`)) {
      before.snapshot.set(`${owner}:${doc.id}`, sectionsOf(owner, Number(doc.id)).map((section) => ({ section, cards: cardsOf(section.id) })))
    }
  }
  prepare?.(exec, seed.all)
  for (const statement of await buildSectionsToFields(seed.read)) exec(statement)
  return { ...seed, before }
}

const id = (all: (query: string) => Row[], table: string, slug: string) => Number(all(`SELECT id FROM ${table} WHERE slug = '${slug}'`)[0].id)

describe('moving legacy section content into the form fields', () => {
  it('fills every Portfolio field from its sections and unlinks them', async () => {
    const { all, before } = await migrated()
    const bms = id(all, 'case_study', 'smart-bms')
    const old = before.snapshot.get(`case_study:${bms}`)!
    const byKey = (key: string) => old.filter((entry) => entry.section.section_key === key)

    expect(all(`SELECT label, text FROM case_study_project_overview WHERE _parent_id = ${bms} ORDER BY _order`)).toEqual(
      byKey('overview')[0].cards.map((card) => ({ label: card.title, text: card.short_description })),
    )
    expect(all(`SELECT label, value FROM case_study_glance_at_a_glance WHERE _parent_id = ${bms} ORDER BY _order`)).toEqual(
      byKey('glance')[0].cards.map((card) => ({ label: card.title, value: card.value })),
    )
    const groups = all(`SELECT id, heading FROM case_study_specs_spec_groups WHERE _parent_id = ${bms} ORDER BY _order`)
    expect(groups.map((group) => group.heading)).toEqual(byKey('spec').map((entry) => entry.section.heading))
    for (const [index, group] of groups.entries()) {
      const rows = all(`SELECT label, value, built_in FROM case_study_specs_spec_groups_rows WHERE _parent_id = '${group.id}' ORDER BY _order`)
      expect(rows).toEqual(byKey('spec')[index].cards.map((card) => ({ label: card.title, value: card.value, built_in: card.icon === 'check' ? 1 : 0 })))
    }
    expect(groups.length).toBe(3)

    const doc = all(`SELECT * FROM case_study WHERE id = ${bms}`)[0]
    expect(doc.features_heading).toBe(byKey('features')[0].section.heading)
    expect(doc.features_intro).toBe(byKey('features')[0].section.subheading)
    expect(all(`SELECT text FROM case_study_features_items WHERE _parent_id = ${bms} ORDER BY _order`).map((row) => row.text)).toEqual(byKey('features')[0].cards.map((card) => card.title))
    expect(doc.specs_heading).toBe(byKey('specs-note')[0].section.heading)
    expect(doc.gap_heading).toBe(byKey('gap')[0].section.heading)
    expect(all(`SELECT title, text FROM case_study_gap_cards WHERE _parent_id = ${bms} ORDER BY _order`)).toEqual(
      byKey('gap')[0].cards.map((card) => ({ title: card.title, text: card.short_description })),
    )

    expect(all(`SELECT id FROM case_study_rels WHERE parent_id = ${bms} AND path = 'layoutSections'`)).toEqual([])
    expect(all(`SELECT id FROM section WHERE id IN (${old.map((entry) => entry.section.id).join(',')})`)).toEqual([])
    const version = all(`SELECT id FROM _case_study_v WHERE parent_id = ${bms} AND latest = 1`)
    expect(version.length).toBe(1)
    expect(all(`SELECT count(*) AS n FROM _case_study_v_version_specs_spec_groups_rows r JOIN _case_study_v_version_specs_spec_groups g ON g.id = r._parent_id WHERE g._parent_id = ${version[0].id}`)[0].n).toBe(24)
  })

  it('fills every Capability field from its sections and keeps only the breadcrumb hero linked', async () => {
    const { all, before } = await migrated()
    const firmware = id(all, 'capability', 'firmware')
    const old = before.snapshot.get(`capability:${firmware}`)!
    const one = (key: string) => old.find((entry) => entry.section.section_key === key)!
    const doc = all(`SELECT * FROM capability WHERE id = ${firmware}`)[0]
    const hero = one('hero').section

    expect(doc.hero_eyebrow).toBe(hero.eyebrow)
    expect(doc.hero_cta_label).toBe(hero.cta_label)
    expect(doc.hero_secondary_cta_href).toBe(hero.secondary_cta_href)
    expect(doc.scope_included_heading).toBe(one('included').section.heading)
    expect(all(`SELECT title, icon, text, tags FROM capability_scope_included WHERE _parent_id = ${firmware} ORDER BY _order`)).toEqual(
      one('included').cards.map((card) => ({ title: card.title, icon: card.icon, text: card.short_description, tags: card.tags })),
    )
    const stacks = old.filter((entry) => String(entry.section.section_key).startsWith('stack-'))
    expect(all(`SELECT heading FROM capability_technology_stacks WHERE _parent_id = ${firmware} ORDER BY _order`).map((row) => row.heading)).toEqual(stacks.map((entry) => entry.section.heading))
    expect(String(doc.process_workflow).split('\n')).toEqual(one('workflow').cards.map((card) => (card.short_description ? `${card.title} | ${card.short_description}` : card.title)))
    expect(all(`SELECT question FROM capability_faq_faqs WHERE _parent_id = ${firmware} ORDER BY _order`).map((row) => row.question)).toEqual(one('faq').cards.map((card) => card.title))

    const linked = all(`SELECT s.section_key AS k FROM capability_rels r JOIN section s ON s.id = r.section_id WHERE r.parent_id = ${firmware} AND r.path = 'layoutSections'`)
    expect(linked.map((row) => row.k)).toEqual(['hero'])
    const keptHero = all(`SELECT heading, eyebrow, cta_label FROM section WHERE id = ${hero.id}`)[0]
    expect(keptHero).toEqual({ heading: null, eyebrow: null, cta_label: null })
  })

  it('turns related-project slugs into relationship rows and drops slugs of deleted documents', async () => {
    const { all, before } = await migrated()
    for (const capability of all(`SELECT id FROM capability`)) {
      const projects = before.snapshot.get(`capability:${capability.id}`)!.find((entry) => entry.section.section_key === 'projects')
      if (!projects) continue
      const existing = String(projects.section.tags).split(',').map((slug) => slug.trim()).filter((slug) => all(`SELECT id FROM case_study WHERE slug = '${slug}'`).length)
      const rows = all(`SELECT c.slug AS slug FROM capability_rels r JOIN case_study c ON c.id = r.case_study_id WHERE r.parent_id = ${capability.id} AND r.path = 'related.relatedProjects' ORDER BY r."order"`)
      expect(rows.map((row) => row.slug)).toEqual(existing)
    }
    expect(all(`SELECT id FROM section WHERE type IN ('articles', 'projects') AND tags LIKE '%ble-mesh-rs485-energy-meter%'`)).toEqual([])
  })

  it('fills the Industry fields and keeps the generated "other industries" section linked', async () => {
    const { all, before } = await migrated()
    const ev = id(all, 'industry', 'ev')
    const old = before.snapshot.get(`industry:${ev}`)!
    const one = (key: string) => old.find((entry) => entry.section.section_key === key)
    const doc = all(`SELECT * FROM industry WHERE id = ${ev}`)[0]
    if (one('challenges')) expect(String(doc.challenges).split('\n').length).toBe(one('challenges')!.cards.length)
    if (one('how')) expect(String(doc.process).split('\n').length).toBe(one('how')!.cards.length)
    const linked = all(`SELECT s.section_key AS k FROM industry_rels r JOIN section s ON s.id = r.section_id WHERE r.parent_id = ${ev} AND r.path = 'layoutSections' ORDER BY r."order"`).map((row) => row.k)
    expect(linked).toEqual(['hero', 'others'])
  })

  it('never overwrites a value already typed into the form', async () => {
    const { all } = await migrated((exec, query) => {
      const firmware = Number(query(`SELECT id FROM capability WHERE slug = 'firmware'`)[0].id)
      exec(`UPDATE capability SET process_workflow_heading = 'Typed in the form' WHERE id = ${firmware}`)
    })
    expect(all(`SELECT process_workflow_heading FROM capability WHERE slug = 'firmware'`)[0].process_workflow_heading).toBe('Typed in the form')
  })

  it('has nothing left to do on a second run', async () => {
    const { read } = await migrated()
    expect(await buildSectionsToFields(read)).toEqual([])
  })
})

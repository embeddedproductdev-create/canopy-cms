import { describe, expect, it } from 'vitest'
import { buildRemoveReferences, ownSectionIds } from '../../src/utilities/removeReferences'
import { currentSeed } from './helpers/currentSeed'

describe('removing references to a deleted document', () => {
  it('removes a deleted project from every slug list, button and its own sections, and keeps everything else', async () => {
    const { db, read, all } = await currentSeed()
    const project = all(`SELECT id, slug FROM case_study WHERE slug = 'smart-bms'`)[0]
    const own = await ownSectionIds(read, 'case-study', Number(project.id))
    expect(own.length).toBeGreaterThan(0)
    const sectionsBefore = Number(all('SELECT count(*) AS n FROM section')[0].n)

    db.exec(`DELETE FROM case_study WHERE id = ${project.id}`)
    for (const statement of await buildRemoveReferences(read, { collection: 'case-study', id: Number(project.id), slug: 'smart-bms', ownSections: own })) db.exec(statement)

    expect(all(`SELECT id FROM section WHERE tags LIKE '%smart-bms%'`)).toEqual([])
    expect(all(`SELECT id FROM section WHERE cta_href LIKE '%/work/smart-bms%' OR secondary_cta_href LIKE '%/work/smart-bms%'`)).toEqual([])
    expect(all(`SELECT id FROM section WHERE tags LIKE '%dual-channel-charger%'`).length).toBeGreaterThan(0)
    expect(all(`SELECT id FROM section WHERE id IN (${own.join(',')})`)).toEqual([])
    expect(Number(all('SELECT count(*) AS n FROM section')[0].n)).toBe(sectionsBefore - own.length)
    expect(all(`SELECT id FROM case_study_rels WHERE parent_id = ${project.id}`)).toEqual([])
  })

  it('removes a deleted capability from the menu and from cards that link to it', async () => {
    const { db, read, all } = await currentSeed()
    const capability = all(`SELECT id, slug FROM capability WHERE slug = 'firmware'`)[0]
    const own = await ownSectionIds(read, 'capability', Number(capability.id))
    db.exec(`DELETE FROM capability WHERE id = ${capability.id}`)
    for (const statement of await buildRemoveReferences(read, { collection: 'capability', id: Number(capability.id), slug: 'firmware', ownSections: own })) db.exec(statement)

    expect(String(all('SELECT nav_items FROM header')[0].nav_items)).not.toContain('/capabilities/firmware')
    expect(String(all('SELECT nav_items FROM header')[0].nav_items)).toContain('/capabilities/pcb-design')
    expect(all(`SELECT r.id FROM section_rels r JOIN card c ON c.id = r.card_id WHERE c.cta_url LIKE '/capabilities/firmware%'`)).toEqual([])
  })

  it('strips a deleted insight from related-article sections and relationship fields', async () => {
    const { db, read, all } = await currentSeed()
    db.exec(`INSERT INTO section (title, type, variant, heading, tags, updated_at, created_at) VALUES ('Test - Insights', 'articles', 'related', 'Insights', 'how-to-choose-iot-protocol, other-post', 'x', 'x')`)
    const capability = Number(all(`SELECT id FROM capability LIMIT 1`)[0].id)
    db.exec(`INSERT INTO capability_rels ("order", parent_id, path, blog_id) VALUES (1, ${capability}, 'related.relatedInsights', 1)`)
    db.exec(`DELETE FROM blog WHERE id = 1`)
    for (const statement of await buildRemoveReferences(read, { collection: 'blog', id: 1, slug: 'how-to-choose-iot-protocol', ownSections: [] })) db.exec(statement)

    expect(all(`SELECT tags FROM section WHERE title = 'Test - Insights'`)[0].tags).toBe('other-post')
    expect(all(`SELECT id FROM capability_rels WHERE blog_id = 1`)).toEqual([])
  })

  it('leaves a section alone when another page still uses it', async () => {
    const { read, all } = await currentSeed()
    const shared = all(`SELECT section_id AS id FROM page_rels WHERE section_id IS NOT NULL LIMIT 1`)[0]
    const statements = await buildRemoveReferences(read, { collection: 'capability', id: 999, slug: 'none', ownSections: [Number(shared.id)] })
    const deleted = statements.filter((statement) => statement.startsWith('DELETE FROM "section" ')).flatMap((statement) => (statement.match(/[0-9]+/g) ?? []).map(Number))
    expect(deleted).not.toContain(Number(shared.id))
  })
})

describe('delete hooks', () => {
  it('clean up references whenever an insight, project, capability or industry is deleted', async () => {
    const { default: config } = await import('@/payload.config')
    const collections = (await config).collections
    for (const slug of ['blog', 'case-study', 'capability', 'industry']) {
      const hooks = collections.find((collection) => collection.slug === slug)?.hooks
      expect(hooks?.beforeDelete?.length, slug).toBeGreaterThan(0)
      expect(hooks?.afterDelete?.some((hook) => hook.name === 'removeReferencesHook'), slug).toBe(true)
    }
  }, 60_000)
})

import { describe, expect, it } from 'vitest'
import { buildSectionsToFields, buildSectionsToFieldsSchema } from '../../src/migrations/20261102_000000_sections_to_fields'
import { buildCapabilityBreadcrumbs, buildCapabilityBreadcrumbsSchema } from '../../src/migrations/20261103_000000_capability_breadcrumbs'
import { currentSeed } from './helpers/currentSeed'

async function migrated() {
  const seed = await currentSeed()
  for (const build of [buildSectionsToFieldsSchema, buildSectionsToFields]) for (const statement of await build(seed.read)) seed.db.exec(statement)
  const firmware = Number(seed.all(`SELECT id FROM capability WHERE slug = 'firmware'`)[0].id)
  const hero = seed.all(`SELECT section_id AS id FROM capability_rels WHERE parent_id = ${firmware} AND path = 'layoutSections'`)
  const crumbs = seed.all(`SELECT c.title, c.cta_url FROM section_rels r JOIN card c ON c.id = r.card_id WHERE r.parent_id = ${Number(hero[0].id)} AND c.type = 'breadcrumb' ORDER BY r."order"`)
  for (const build of [buildCapabilityBreadcrumbsSchema, buildCapabilityBreadcrumbs]) for (const statement of await build(seed.read)) seed.db.exec(statement)
  return { ...seed, firmware, heroId: Number(hero[0].id), crumbs }
}

describe('Capability breadcrumbs', () => {
  it('moves the hero breadcrumb into the Hero > Breadcrumb field', async () => {
    const { all, firmware, crumbs } = await migrated()
    expect(crumbs.length).toBe(2)
    expect(all(`SELECT label, url FROM capability_hero_breadcrumbs WHERE _parent_id = ${firmware} ORDER BY _order`)).toEqual(crumbs.map((crumb) => ({ label: crumb.title, url: crumb.cta_url })))
  })

  it('removes the hidden hero sections Capabilities no longer have a field for', async () => {
    const { all, heroId } = await migrated()
    expect(all(`SELECT id FROM capability_rels WHERE path = 'layoutSections'`)).toEqual([])
    expect(all(`SELECT id FROM section WHERE id = ${heroId}`)).toEqual([])
  })

  it('has nothing left to do on a second run', async () => {
    const { read } = await migrated()
    expect(await buildCapabilityBreadcrumbsSchema(read)).toEqual([])
    expect(await buildCapabilityBreadcrumbs(read)).toEqual([])
  })
})

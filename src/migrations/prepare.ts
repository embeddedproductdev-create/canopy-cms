import { sql } from '@payloadcms/db-d1-sqlite'
import { preserveLegacyTags } from './20261002_001700_preserve_legacy_tags'
import { applyWireframeContentModel } from './20261009_120000_wireframe_content_model'
import { applyDetailCollections } from './20261010_120000_detail_collections'
import { applySectionCardCleanup } from './20261012_120000_section_card_cleanup'
import { applyProjectContentAndCleanup } from './20261013_120000_project_content_and_cleanup'
import { applyRestructure } from './20261014_120000_restructure_collections'
import { applyHowWeWork } from './20261015_120000_how_we_work_steps'
import { applyJsonSiteSettings } from './20261016_120000_json_site_settings'
import { buildVersionRepair } from './versions'

type Db = Parameters<typeof applyRestructure>[0]

async function runOnce(db: Db, name: string, apply: (db: Db) => Promise<void>): Promise<void> {
  const done = (await db.all(sql.raw(`SELECT "name" FROM "payload_migrations" WHERE "name" = '${name}'`))) as unknown[]
  if (done.length) return
  await apply(db)
  const now = new Date().toISOString()
  await db.run(sql.raw(`INSERT INTO "payload_migrations" ("name", "batch", "updated_at", "created_at") VALUES ('${name}', 1, '${now}', '${now}')`))
}

export async function prepareDatabase(db: Db): Promise<{ rebuiltVersions: number }> {
  await preserveLegacyTags(db)
  await applyWireframeContentModel(db)
  await applyDetailCollections(db)
  await runOnce(db, '20261012_120000_section_card_cleanup', applySectionCardCleanup)
  await runOnce(db, '20261013_120000_project_content_and_cleanup', applyProjectContentAndCleanup)
  await runOnce(db, '20261014_120000_restructure_collections', applyRestructure)
  await runOnce(db, '20261015_120000_how_we_work_steps', applyHowWeWork)
  await runOnce(db, '20261016_120000_json_site_settings', applyJsonSiteSettings)
  const repair = await buildVersionRepair(async (query) => (await db.all(sql.raw(query))) as Record<string, unknown>[])
  for (const statement of repair) await db.run(sql.raw(statement))
  return { rebuiltVersions: repair.length }
}

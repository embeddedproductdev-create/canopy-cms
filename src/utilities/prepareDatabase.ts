import { sql } from '@payloadcms/db-d1-sqlite'
import { preserveLegacyTags } from '../migrations/20261002_001700_preserve_legacy_tags'
import { applyWireframeContentModel } from '../migrations/20261009_120000_wireframe_content_model'
import { applyDetailCollections } from '../migrations/20261010_120000_detail_collections'
import { applySectionCardCleanup } from '../migrations/20261012_120000_section_card_cleanup'
import { applyProjectContentAndCleanup } from '../migrations/20261013_120000_project_content_and_cleanup'
import { applyRestructure } from '../migrations/20261014_120000_restructure_collections'
import { applyHowWeWork } from '../migrations/20261015_120000_how_we_work_steps'
import { applyJsonSiteSettings } from '../migrations/20261016_120000_json_site_settings'
import { applyContentColumns } from '../migrations/20261027_000000_complete_content_columns'
import { applyBlogMarkdownContent } from '../migrations/20261028_000000_blog_markdown_content'
import { applyHeroImageFit } from '../migrations/20261029_000000_hero_image_fit'
import { applySectionGroups } from '../migrations/20261030_000000_section_groups'
import { applyPayload392Columns } from '../migrations/20261031_000000_payload_3_92_columns'
import { applyFormSubmissionPhone } from '../migrations/20261101_000000_form_submission_phone'
import { applySectionsToFields } from '../migrations/20261102_000000_sections_to_fields'
import { applyCapabilityBreadcrumbs } from '../migrations/20261103_000000_capability_breadcrumbs'
import { buildVersionRepair } from './versionRepair'

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
  await runOnce(db, '20261027_000000_complete_content_columns', applyContentColumns)
  await runOnce(db, '20261028_000000_blog_markdown_content', applyBlogMarkdownContent)
  await runOnce(db, '20261029_000000_hero_image_fit', applyHeroImageFit)
  await runOnce(db, '20261030_000000_section_groups', applySectionGroups)
  await runOnce(db, '20261031_000000_payload_3_92_columns', applyPayload392Columns)
  await runOnce(db, '20261101_000000_form_submission_phone', applyFormSubmissionPhone)
  await runOnce(db, '20261102_000000_sections_to_fields', applySectionsToFields)
  await runOnce(db, '20261103_000000_capability_breadcrumbs', applyCapabilityBreadcrumbs)
  const repair =await buildVersionRepair(async (query) => (await db.all(sql.raw(query))) as Record<string, unknown>[])
  for (const statement of repair) await db.run(sql.raw(statement))
  return { rebuiltVersions: repair.length }
}

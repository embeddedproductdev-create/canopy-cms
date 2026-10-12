import config from '../src/payload.config'
import { getPayload } from 'payload'
import { preserveLegacyTags } from '../src/migrations/20261002_001700_preserve_legacy_tags'
import { applyWireframeContentModel } from '../src/migrations/20261009_120000_wireframe_content_model'
import { applyDetailCollections } from '../src/migrations/20261010_120000_detail_collections'

try {
  const payload = await getPayload({ config })
  await preserveLegacyTags(payload.db.drizzle)
  await applyWireframeContentModel(payload.db.drizzle)
  await applyDetailCollections(payload.db.drizzle)
  console.info('Prepared CMS tag and wireframe content fields without dropping legacy data.')
  await new Promise((resolve) => setTimeout(resolve, 3000))
  process.exit(0)
} catch (error) {
  console.error('Failed to prepare CMS tag fields:', error)
  process.exit(1)
}

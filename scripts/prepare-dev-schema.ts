import config from '../src/payload.config'
import { getPayload } from 'payload'
import { prepareDatabase } from '../src/utilities/prepareDatabase'

try {
  const payload = await getPayload({ config })
  const { rebuiltVersions } = await prepareDatabase(payload.db.drizzle)
  if (rebuiltVersions) console.info('Rebuilt missing draft versions so the admin lists show every document.')
  console.info('Prepared the local CMS database without dropping data.')
  await new Promise((resolve) => setTimeout(resolve, 3000))
  process.exit(0)
} catch (error) {
  console.error('Failed to prepare the local CMS database:', error)
  process.exit(1)
}

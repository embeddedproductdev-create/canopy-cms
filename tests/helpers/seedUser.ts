import { getPayload } from 'payload'
import config from '../../src/payload.config.js'

export const testUser = {
  name: 'Test User',
  role: 'admin' as const,
  email: 'dev@payloadcms.com',
  password: 'test',
}

/**
 * Seeds a test user for e2e admin tests.
 */
export async function seedTestUser(): Promise<void> {
  const payload = await getPayload({ config })

  // Delete existing test user if any
  await payload.delete({
    collection: 'user',
    where: {
      email: {
        equals: testUser.email,
      },
    },
  })

  // Create fresh test user
  await payload.create({
    collection: 'user',
    data: testUser,
    draft: false,
  })
}

/**
 * Cleans up test user after tests
 */
export async function cleanupTestUser(): Promise<void> {
  const payload = await getPayload({ config })

  await payload.delete({
    collection: 'user',
    where: {
      email: {
        equals: testUser.email,
      },
    },
  })
}

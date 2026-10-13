import { getPayload, Payload } from 'payload'
import { sql } from '@payloadcms/db-d1-sqlite'
import config from '@/payload.config'

import { describe, it, beforeAll, expect } from 'vitest'

let payload: Payload
let prepared = false

describe('API', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
    const done = (await payload.db.drizzle.all(
      sql.raw(`SELECT "name" FROM "payload_migrations" WHERE "name" = '20261014_120000_restructure_collections'`),
    )) as unknown[]
    prepared = done.length > 0
  })

  it('lists every Page, Portfolio project, Insight and Checklist in the admin (draft) lists', async (ctx) => {
    if (!prepared) ctx.skip()
    for (const collection of ['page', 'case-study', 'blog', 'checklist'] as const) {
      const published = await payload.find({ collection, limit: 500, depth: 0 })
      const drafts = await payload.find({ collection, limit: 500, depth: 0, draft: true })
      expect(published.totalDocs).toBeGreaterThan(0)
      expect(drafts.totalDocs).toBe(published.totalDocs)
    }
  })

  it('fetches users', async () => {
    const users = await payload.find({
      collection: 'user',
    })
    expect(users).toBeDefined()
  })
})

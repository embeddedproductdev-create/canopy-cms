import config from '@/payload.config'

import { describe, it, expect } from 'vitest'

describe('allowed origins', () => {
  it('trusts the CMS itself, the website and local development', async () => {
    const payloadConfig = await config
    const expected = [
      'https://canopy-cms.embeddedproductdev.workers.dev',
      'https://canopyembedded.com',
      'https://www.canopyembedded.com',
      'https://canopy-d28.pages.dev',
      'http://localhost:3000',
      'http://localhost:4200',
    ]
    for (const origin of expected) {
      expect(payloadConfig.csrf).toContain(origin)
      expect(payloadConfig.cors).toContain(origin)
    }
  })
})

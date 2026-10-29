import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import config from '@/payload.config'
import nextConfig from '../../next.config'
import { MAX_IMPORT_RECORDS } from '@/utilities/transferLimits'
import { sitemapQuery } from '@/utilities/sitemapQuery'

type Rule = { source: string; headers: { key: string; value: string }[] }
const rules = async (): Promise<Rule[]> => (await (nextConfig as { headers: () => Promise<Rule[]> }).headers()) as Rule[]
const cacheControl = (rule?: Rule) => rule?.headers.find((header) => header.key === 'Cache-Control')?.value ?? ''

describe('Worker resource limits', () => {
  it('caps populate depth and page sizes so a request cannot load the whole database', async () => {
    const payloadConfig = await config
    expect(payloadConfig.maxDepth).toBe(3)
    for (const collection of payloadConfig.collections.filter((c) => !c.slug.startsWith('payload-'))) {
      expect(collection.admin.pagination.defaultLimit, collection.slug).toBe(25)
      expect(collection.admin.pagination.limits, collection.slug).toEqual([10, 25, 50])
    }
  })

  it('does not ship GraphQL, which the website never uses', async () => {
    const payloadConfig = await config
    expect(payloadConfig.graphQL.disable).toBe(true)
    const root = path.resolve(__dirname, '../../src/app/(payload)/api')
    expect(fs.existsSync(path.join(root, 'graphql'))).toBe(false)
    expect(fs.existsSync(path.join(root, 'graphql-playground'))).toBe(false)
  })

  it('limits uploads to 10 MB because the Worker buffers them in memory', async () => {
    const payloadConfig = await config
    expect(payloadConfig.upload.limits?.fileSize).toBe(10 * 1024 * 1024)
  })

  it('limits an import file to 100 records', () => {
    expect(MAX_IMPORT_RECORDS).toBe(100)
  })

  it('loads only the fields the sitemap needs', () => {
    expect(sitemapQuery.depth).toBe(0)
    expect(sitemapQuery.limit).toBeLessThanOrEqual(500)
    expect(Object.keys(sitemapQuery.select).sort()).toEqual(['slug', 'seo', 'updatedAt', 'url'].sort())
  })

  it('lets browsers and the future edge cache public content and media, never private routes', async () => {
    const all = await rules()
    const forSource = (needle: string) => all.find((rule) => rule.source.includes(needle))
    expect(cacheControl(forSource('/api/media/file'))).toMatch(/public, max-age=3600, s-maxage=3600/)
    const publicContent = forSource('case-study')
    expect(cacheControl(publicContent)).toMatch(/public, max-age=60, s-maxage=300, stale-while-revalidate=300/)
    for (const privateSource of ['/api/users', '/admin', '/api/form-submission']) {
      const rule = all.find((r) => cacheControl(r).startsWith('public') && r.source.includes(privateSource))
      expect(rule, privateSource).toBeUndefined()
    }
    expect(cacheControl(forSource('/api/form-submission'))).toContain('no-store')
  })

  it('logs every invocation and lifts the CPU limit for heavy admin work', () => {
    const wrangler = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../wrangler.jsonc'), 'utf8')) as {
      observability: { enabled: boolean; logs?: { invocation_logs?: boolean; head_sampling_rate?: number } }
      limits?: { cpu_ms?: number }
    }
    expect(wrangler.observability.enabled).toBe(true)
    expect(wrangler.observability.logs?.invocation_logs).toBe(true)
    expect(wrangler.observability.logs?.head_sampling_rate).toBe(1)
    expect(wrangler.limits?.cpu_ms).toBe(300000)
  })
})

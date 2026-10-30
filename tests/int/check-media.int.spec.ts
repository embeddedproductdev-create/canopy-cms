import { describe, expect, it } from 'vitest'
import { checkMedia } from '../../scripts/lib/check-media'

const listing = (urls: (string | null)[]) => ({ docs: urls.map((url, index) => ({ id: index + 1, filename: `f${index}`, url })) })

describe('checking that every media file is served', () => {
  it('reports each file that does not answer 200, with its status', async () => {
    const statuses: Record<string, number> = { '/api/media/file/a.jpg': 200, '/api/media/file/b.png': 404 }
    const result = await checkMedia('https://cms.test', async (url) => {
      if (url.endsWith('/api/media?limit=200&depth=0')) return { status: 200, json: async () => listing(['/api/media/file/a.jpg', '/api/media/file/b.png', null]) }
      return { status: statuses[new URL(url).pathname] ?? 500, json: async () => ({}) }
    })
    expect(result).toEqual({ checked: 2, broken: ['/api/media/file/b.png -> 404'] })
  })

  it('fails when the media list itself cannot be read', async () => {
    await expect(checkMedia('https://cms.test', async () => ({ status: 503, json: async () => ({}) }))).rejects.toThrow('503')
  })
})

import { describe, expect, it } from 'vitest'
import { r2Storage } from '@payloadcms/storage-r2'
import type { Config } from 'payload'
import { Media } from '../../src/collections/Media'
import { STORAGE_COLUMNS } from '../../scripts/lib/storage-columns'
import { buildMediaObjectKey } from '../../src/migrations/20261104_000000_media_object_key'
import expected from '../../scripts/lib/expected-schema.json'
import { currentSeed } from './helpers/currentSeed'

const snake = (name: string) => name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)

describe('columns the R2 storage plugin needs on the live database', () => {
  it('lists every field the plugin adds to media (it only runs in production, so the schema check must add them)', async () => {
    const config = (await r2Storage({ bucket: {} as never, collections: { media: true } })({ collections: [Media] } as unknown as Config)) as Config
    const before = new Set(Media.fields.map((field) => ('name' in field ? field.name : '')))
    const added = config.collections!.find((c) => c.slug === 'media')!.fields.map((field) => ('name' in field ? field.name : '')).filter((name) => name && !before.has(name) && name !== 'url')
    expect(added.map(snake).sort()).toEqual([...STORAGE_COLUMNS.media].sort())
  })

  it('makes the schema check expect them, so a database without them fails before deploy', () => {
    for (const column of STORAGE_COLUMNS.media) expect((expected as Record<string, string[]>).media).toContain(column)
  })

  it('adds the missing column to media once', async () => {
    const { db, read, all } = await currentSeed()
    for (const statement of await buildMediaObjectKey(read)) db.exec(statement)
    expect(all(`SELECT name FROM pragma_table_info('media')`).map((row) => row.name)).toContain('_object_key')
    expect(all(`SELECT count(*) AS n FROM media WHERE _object_key IS NOT NULL`)[0].n).toBe(0)
    expect(await buildMediaObjectKey(read)).toEqual([])
  })
})

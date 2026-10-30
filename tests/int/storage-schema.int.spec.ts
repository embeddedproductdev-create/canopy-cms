import { describe, expect, it } from 'vitest'
import toSnakeCase from 'to-snake-case'
import { r2Storage } from '@payloadcms/storage-r2'
import type { Config } from 'payload'
import { Media } from '../../src/collections/Media'
import { STORAGE_COLUMNS } from '../../scripts/lib/storage-columns'
import { buildMediaObjectkeyColumn } from '../../src/migrations/20261105_000000_media_objectkey_column'
import expected from '../../scripts/lib/expected-schema.json'
import { currentSeed } from './helpers/currentSeed'

// The column name Payload's SQLite adapter gives a field (@payloadcms/drizzle traverseFields): `_objectKey` -> `_objectkey`.
const columnOf = (name: string) => `${name[0] === '_' ? '_' : ''}${toSnakeCase(name)}`

describe('columns the R2 storage plugin needs on the live database', () => {
  it('lists every field the plugin adds to media (it only runs in production, so the schema check must add them)', async () => {
    const config = (await r2Storage({ bucket: {} as never, collections: { media: true } })({ collections: [Media] } as unknown as Config)) as Config
    const before = new Set(Media.fields.map((field) => ('name' in field ? field.name : '')))
    const added = config.collections!.find((c) => c.slug === 'media')!.fields.map((field) => ('name' in field ? field.name : '')).filter((name) => name && !before.has(name) && name !== 'url')
    expect(added.map(columnOf).sort()).toEqual([...STORAGE_COLUMNS.media].sort())
  })

  it('makes the schema check expect them, so a database without them fails before deploy', () => {
    for (const column of STORAGE_COLUMNS.media) expect((expected as Record<string, string[]>).media).toContain(column)
  })

  it('adds the missing column to media once', async () => {
    const { db, read, all } = await currentSeed()
    for (const statement of await buildMediaObjectkeyColumn(read)) db.exec(statement)
    expect(all(`SELECT name FROM pragma_table_info('media')`).map((row) => row.name)).toContain('_objectkey')
    expect(all(`SELECT count(*) AS n FROM media WHERE _objectkey IS NOT NULL`)[0].n).toBe(0)
    expect(await buildMediaObjectkeyColumn(read)).toEqual([])
  })
})

describe('where the R2 plugin looks for a file', () => {
  // Runs the plugin's real serve path with a stub bucket that records the key it is asked for.
  async function keyFor(objectKey: unknown): Promise<string> {
    const { getStorageFilePath } = await import('@payloadcms/plugin-cloud-storage/utilities')
    return getStorageFilePath({ collection: Media, collectionPrefix: '', doc: { _objectKey: objectKey } as never, filename: 'raw-fw-1.jpg', req: {} as never } as never)
  }

  it('asks R2 for "_objectkey/raw-fw-1.jpg" when the column is missing (SQLite returns its name), which does not exist', async () => {
    expect(await keyFor('_objectkey')).toBe('_objectkey/raw-fw-1.jpg')
  })

  it('asks R2 for "raw-fw-1.jpg", where the uploaded files are, once the column exists and is empty', async () => {
    expect(await keyFor(null)).toBe('raw-fw-1.jpg')
  })
})

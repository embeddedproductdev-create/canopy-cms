import type { Endpoint, Payload } from 'payload'
import { hasRole } from '../access'
import { sectionGroups } from '../migrations/20261030_000000_section_groups'
import { MAX_IMPORT_RECORDS } from './transferLimits'

export type TransferCollection = 'blog' | 'case-study' | 'capability' | 'industry'
type RelatedCollection = TransferCollection | 'checklist'
type TransferRecord = Record<string, unknown>

const IMPORTABLE_COLLECTIONS = new Set<TransferCollection>(['blog', 'case-study', 'capability'])
const MAX_RECORDS = MAX_IMPORT_RECORDS
const MAX_IMPORT_BYTES = 5 * 1024 * 1024

const isRecord = (value: unknown): value is TransferRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const relationId = (value: unknown): number | string | null => {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (isRecord(value) && (typeof value.id === 'number' || typeof value.id === 'string')) return value.id
  return null
}

const cleanNestedIds = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(cleanNestedIds)
  if (!isRecord(value)) return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'id' && key !== '_order')
      .map(([key, child]) => [key, cleanNestedIds(child)]),
  )
}

/**
 * Files exported before the form was split into sections keep every field at the top level. Move those
 * fields into their section so old exports still import; records already in the new shape are untouched.
 */
function nestLegacy(collection: TransferCollection, input: TransferRecord): TransferRecord {
  const spec = sectionGroups.find((entry) => entry.table === collection.replace('-', '_'))
  if (!spec) return input
  const record: TransferRecord = { ...input }
  for (const { group, fields } of spec.groups) {
    const target = isRecord(record[group]) ? { ...(record[group] as TransferRecord) } : {}
    for (const { name } of fields) {
      if (name in record) {
        if (!(name in target)) target[name] = record[name]
        delete record[name]
      }
    }
    if (collection === 'capability' && group === 'hero') {
      for (const [old, current] of [['heroImageFit', 'imageFit'], ['heroImageAlign', 'imageAlign']]) {
        if (old in record) {
          target[current] = record[old]
          delete record[old]
        }
      }
    }
    if (Object.keys(target).length) record[group] = target
  }
  return record
}

const removePath = (record: TransferRecord, key: string): void => {
  delete record[key]
}

const mediaPaths: Partial<Record<TransferCollection, string[]>> = {
  blog: ['cover.image', 'seo.ogImage'],
  'case-study': ['Images.landingImage', 'seo.ogImage'],
  capability: ['hero.image', 'seo.ogImage'],
}

const relationshipPaths: Partial<Record<TransferCollection, Record<string, RelatedCollection>>> = {
  blog: { 'contentUpgrade.checklistLink': 'checklist' },
  'case-study': {},
  capability: { 'related.relatedProjects': 'case-study', 'related.relatedInsights': 'blog' },
}

function getPath(record: TransferRecord, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => (isRecord(value) ? value[key] : undefined), record)
}

function setPath(record: TransferRecord, path: string, value: unknown): void {
  const parts = path.split('.')
  const final = parts.pop()
  if (!final) return
  let target = record
  for (const part of parts) {
    const next = target[part]
    if (!isRecord(next)) target[part] = {}
    target = target[part] as TransferRecord
  }
  target[final] = value
}

async function resolveMedia(payload: Payload, value: unknown): Promise<number | null> {
  if (value === null || value === undefined || value === '') return null
  if (isRecord(value) && typeof value.filename === 'string') {
    const found = await payload.find({
      collection: 'media',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { filename: { equals: value.filename } },
    })
    if (found.docs[0]) return Number(found.docs[0].id)
    throw new Error(`Media file "${value.filename}" is not present in this CMS. Upload it before importing.`)
  }
  const id = relationId(value)
  if (id === null) throw new Error('An image reference must contain a media id or filename.')
  const found = await payload.findByID({ collection: 'media', id, depth: 0, overrideAccess: true })
  if (!found) throw new Error(`Media id "${id}" does not exist in this CMS.`)
  return Number(found.id)
}

async function findRelatedBySlug(payload: Payload, collection: RelatedCollection, slug: string) {
  switch (collection) {
    case 'blog':
      return (await payload.find({ collection, depth: 0, limit: 1, overrideAccess: true, where: { slug: { equals: slug } } })).docs[0]
    case 'case-study':
      return (await payload.find({ collection, depth: 0, limit: 1, overrideAccess: true, where: { slug: { equals: slug } } })).docs[0]
    case 'capability':
      return (await payload.find({ collection, depth: 0, limit: 1, overrideAccess: true, where: { slug: { equals: slug } } })).docs[0]
    case 'industry':
      return (await payload.find({ collection, depth: 0, limit: 1, overrideAccess: true, where: { slug: { equals: slug } } })).docs[0]
    case 'checklist':
      return (await payload.find({ collection, depth: 0, limit: 1, overrideAccess: true, where: { slug: { equals: slug } } })).docs[0]
  }
}

async function findRelatedById(payload: Payload, collection: RelatedCollection, id: number | string) {
  switch (collection) {
    case 'blog':
      return payload.findByID({ collection, id, depth: 0, overrideAccess: true })
    case 'case-study':
      return payload.findByID({ collection, id, depth: 0, overrideAccess: true })
    case 'capability':
      return payload.findByID({ collection, id, depth: 0, overrideAccess: true })
    case 'industry':
      return payload.findByID({ collection, id, depth: 0, overrideAccess: true })
    case 'checklist':
      return payload.findByID({ collection, id, depth: 0, overrideAccess: true })
  }
}

async function resolveRelatedRecord(
  payload: Payload,
  collection: RelatedCollection,
  value: unknown,
): Promise<number | string | null> {
  if (value === null || value === undefined || value === '') return null
  if (isRecord(value) && typeof value.slug === 'string') {
    const found = await findRelatedBySlug(payload, collection, value.slug)
    if (found) return found.id
    throw new Error(`Related ${collection} "${value.slug}" is not present in this CMS.`)
  }
  if (typeof value === 'string' && !/^\d+$/.test(value)) {
    const found = await findRelatedBySlug(payload, collection, value)
    if (found) return found.id
    throw new Error(`Related ${collection} "${value}" is not present in this CMS.`)
  }
  const id = relationId(value)
  if (id === null) throw new Error(`A related ${collection} reference must contain a slug or id.`)
  const found = await findRelatedById(payload, collection, id)
  if (!found) throw new Error(`Related ${collection} id "${id}" does not exist in this CMS.`)
  return found.id
}

async function prepareRecord(
  payload: Payload,
  collection: TransferCollection,
  input: TransferRecord,
): Promise<TransferRecord> {
  const data = cleanNestedIds(input) as TransferRecord
  for (const key of ['id', 'createdAt', 'updatedAt', '_status', 'layoutSections']) removePath(data, key)
  const mediaFields = mediaPaths[collection] ?? []
  for (const path of mediaFields) {
    if (path === 'Images.landingImage') {
      const images = isRecord(data.Images) ? data.Images : {}
      images.landingImage = await resolveMedia(payload, images.landingImage)
      data.Images = images
    } else {
      const value = getPath(data, path)
      if (value !== undefined) setPath(data, path, await resolveMedia(payload, value))
    }
  }

  if (collection === 'case-study') {
    const images = isRecord(data.Images) ? data.Images : {}
    const pageImages = Array.isArray(images.pageImages) ? images.pageImages : []
    images.pageImages = await Promise.all(
      pageImages.map(async (entry) => {
        if (!isRecord(entry)) throw new Error('Each page image must be an object with an image reference.')
        return { ...entry, image: await resolveMedia(payload, entry.image) }
      }),
    )
    data.Images = images
  }

  for (const [path, relatedCollection] of Object.entries(relationshipPaths[collection] ?? {})) {
    const value = getPath(data, path)
    if (Array.isArray(value)) {
      setPath(
        data,
        path,
        await Promise.all(value.map((entry) => resolveRelatedRecord(payload, relatedCollection, entry))),
      )
    } else if (value !== undefined) {
      setPath(data, path, await resolveRelatedRecord(payload, relatedCollection, value))
    }
  }
  return data
}

function validateRecord(collection: TransferCollection, record: TransferRecord, index: number): string[] {
  const errors: string[] = []
  const slug = record.slug
  if (typeof record.title !== 'string' || !record.title.trim()) errors.push(`Record ${index + 1}: title is required.`)
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    errors.push(`Record ${index + 1}: slug must be lowercase words separated by hyphens.`)
  }
  if (collection === 'blog') {
    const article = isRecord(record.article) ? record.article : {}
    const publishedAt = typeof article.publishedAt === 'string' ? article.publishedAt : record.publishedDate
    if (typeof publishedAt !== 'string' || Number.isNaN(Date.parse(publishedAt))) {
      errors.push(`Record ${index + 1}: a valid publishedAt is required.`)
    }
    if (typeof record.content === 'string') {
      if (!record.content.trim()) errors.push(`Record ${index + 1}: Markdown content is required.`)
      if (record.meta !== undefined && !isRecord(record.meta)) {
        errors.push(`Record ${index + 1}: meta must be an object.`)
      }
    } else if (!isRecord(record.body)) {
      errors.push(`Record ${index + 1}: content must be a Markdown string or body must be a rich-text object.`)
    }
  }
  return errors
}

type BodyRequest = {
  headers: Headers
  text?: () => Promise<string>
  json?: () => Promise<unknown>
}

async function readImport(req: BodyRequest, collection: TransferCollection): Promise<{
  records: TransferRecord[]
  errors: string[]
  confirmed: boolean
}> {
  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (contentLength > MAX_IMPORT_BYTES) return { records: [], errors: ['The import file exceeds the 5 MB limit.'], confirmed: false }
  let text: string
  if (typeof req.text === 'function') {
    text = await req.text()
  } else if (typeof req.json === 'function') {
    text = JSON.stringify(await req.json())
  } else {
    return { records: [], errors: ['The request body could not be read.'], confirmed: false }
  }
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) {
    return { records: [], errors: ['The import file exceeds the 5 MB limit.'], confirmed: false }
  }
  let document: unknown
  try {
    document = JSON.parse(text)
  } catch {
    return { records: [], errors: ['The import file is not valid JSON.'], confirmed: false }
  }
  if (
    !isRecord(document) ||
    document.format !== 'canopy-content-v1' ||
    document.collection !== collection ||
    !Array.isArray(document.documents)
  ) {
    return { records: [], errors: [`Expected a Canopy export for the "${collection}" collection.`], confirmed: false }
  }
  if (document.documents.length > MAX_RECORDS) {
    return { records: [], errors: [`An import may contain at most ${MAX_RECORDS} records.`], confirmed: false }
  }
  const records = document.documents.filter(isRecord).map((record) => nestLegacy(collection, record))
  const errors: string[] = []
  if (records.length !== document.documents.length) errors.push('Every document must be a JSON object.')
  const slugs = new Set<string>()
  records.forEach((record, index) => {
    errors.push(...validateRecord(collection, record, index))
    if (typeof record.slug === 'string') {
      if (slugs.has(record.slug)) errors.push(`Duplicate slug "${record.slug}" in the import file.`)
      slugs.add(record.slug)
    }
  })
  return { records, errors, confirmed: document.confirmed === true }
}

async function inspectImport(
  payload: Payload,
  collection: TransferCollection,
  records: TransferRecord[],
): Promise<{ creates: string[]; updates: string[]; errors: string[] }> {
  const creates: string[] = []
  const updates: string[] = []
  const errors: string[] = []
  for (const [index, record] of records.entries()) {
    const slug = String(record.slug)
    try {
      await prepareRecord(payload, collection, record)
      const existing = await payload.find({
        collection,
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: { slug: { equals: slug } },
      })
      ;(existing.docs.length ? updates : creates).push(slug)
    } catch (error) {
      errors.push(`Record ${index + 1} (${slug}): ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return { creates, updates, errors }
}

const forbidden = () => Response.json({ error: 'Your role cannot import or export content.' }, { status: 403 })
const unauthorized = () => Response.json({ error: 'Authentication is required.' }, { status: 401 })
const methodNotAllowed = () => Response.json({ error: 'This collection does not support content transfer.' }, { status: 404 })

export function contentTransferEndpoints(collection: TransferCollection): Endpoint[] {
  return [
    {
      path: '/transfer/export',
      method: 'get',
      handler: async (req) => {
        if (!req.user) return unauthorized()
        if (!hasRole(req, 'admin', 'editor')) return forbidden()
        if (!IMPORTABLE_COLLECTIONS.has(collection)) return methodNotAllowed()
        const documents: TransferRecord[] = []
        let page = 1
        let pages = 1
        do {
          const result = await req.payload.find({
            collection,
            depth: 1,
            draft: true,
            limit: 100,
            page,
            overrideAccess: true,
            sort: 'slug',
          })
          pages = result.totalPages
          documents.push(
            ...result.docs.map((document) => {
              const record = { ...document } as unknown as TransferRecord
              for (const key of ['id', 'createdAt', 'updatedAt', 'layoutSections']) removePath(record, key)
              return record
            }),
          )
          page += 1
        } while (page <= pages)
        return Response.json({ format: 'canopy-content-v1', collection, documents })
      },
    },
    {
      path: '/transfer/preview',
      method: 'post',
      handler: async (req) => {
        if (!req.user) return unauthorized()
        if (!hasRole(req, 'admin', 'editor')) return forbidden()
        if (!IMPORTABLE_COLLECTIONS.has(collection)) return methodNotAllowed()
        const { records, errors } = await readImport(req, collection)
        if (errors.length) return Response.json({ creates: [], updates: [], errors }, { status: 422 })
        const preview = await inspectImport(req.payload, collection, records)
        return Response.json(preview, { status: preview.errors.length ? 422 : 200 })
      },
    },
    {
      path: '/transfer/commit',
      method: 'post',
      handler: async (req) => {
        if (!req.user) return unauthorized()
        if (!hasRole(req, 'admin', 'editor')) return forbidden()
        if (!IMPORTABLE_COLLECTIONS.has(collection)) return methodNotAllowed()
        const { records, errors, confirmed } = await readImport(req, collection)
        if (errors.length) return Response.json({ imported: [], errors }, { status: 422 })
        const preview = await inspectImport(req.payload, collection, records)
        if (preview.errors.length) return Response.json({ imported: [], ...preview }, { status: 422 })
        if (!confirmed) {
          return Response.json({ error: 'Explicit confirmation is required before importing.' }, { status: 400 })
        }
        const imported: string[] = []
        const failures: string[] = []
        for (const [index, record] of records.entries()) {
          const slug = String(record.slug)
          try {
            const data = await prepareRecord(req.payload, collection, record)
            const existing = await req.payload.find({
              collection,
              depth: 0,
              limit: 1,
              overrideAccess: true,
              where: { slug: { equals: slug } },
            })
            const draft = record._status !== 'published'
            if (existing.docs[0]) {
              await req.payload.update({
                collection,
                id: existing.docs[0].id,
                data: data as never,
                draft,
                overrideAccess: true,
              })
            } else {
              await req.payload.create({
                collection,
                data: data as never,
                draft,
                overrideAccess: true,
              })
            }
            imported.push(slug)
          } catch (error) {
            failures.push(`Record ${index + 1} (${slug}): ${error instanceof Error ? error.message : String(error)}`)
          }
        }
        return Response.json({ imported, errors: failures }, { status: failures.length ? 207 : 200 })
      },
    },
  ]
}

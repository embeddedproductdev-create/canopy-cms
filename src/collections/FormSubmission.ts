import { APIError, type CollectionConfig } from 'payload'
import { notifyOnSubmission } from '../hooks/notifySubmission'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const REQUIRED: Record<string, string[]> = {
  engagement: ['name', 'company', 'message'],
  consultation: ['name', 'company', 'message'],
  checklist: ['company'],
  subscribe: [],
}
const MAX = { name: 120, company: 160, scope: 200, message: 4000, email: 254, source: 300, checklist: 120 } as const
const RATE_LIMIT_MS = 30_000

const clean = (value: unknown, max: number): string => String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max)

export const FormSubmission: CollectionConfig = {
  slug: 'form-submission',
  labels: { singular: 'Form Submission', plural: 'Form Submissions' },
  admin: {
    useAsTitle: 'email',
    group: 'Form Submissions',
    defaultColumns: ['email', 'form', 'name', 'company', 'status', 'createdAt'],
    listSearchableFields: ['email', 'name', 'company', 'form'],
  },
  defaultSort: '-createdAt',
  access: {
    create: () => true,
    read: ({ req: { user } }) => !!user,
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) => !!user,
  },
  endpoints: [
    {
      path: '/purge-archive',
      method: 'post',
      handler: async (req) => {
        if (!req.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
        const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
        const result = await req.payload.delete({
          collection: 'form-submission',
          where: { and: [{ status: { equals: 'archived' } }, { archivedAt: { less_than: cutoff } }] },
          overrideAccess: true,
        })
        return Response.json({ deleted: result.docs.length })
      },
    },
  ],
  hooks: {
    afterChange: [notifyOnSubmission],
    beforeValidate: [
      async ({ data, operation, req }) => {
        if (operation !== 'create' || !data) return data
        if (typeof data['website'] === 'string' && data['website'].trim() !== '') {
          throw new APIError('Invalid submission', 400)
        }
        if (typeof data['email'] !== 'string' || !EMAIL.test(data['email'].trim())) {
          throw new APIError('A valid email address is required', 400)
        }
        const form = clean(data['form'], 40).toLowerCase()
        const next = {
          ...data,
          form,
          email: clean(data['email'], MAX.email),
          name: clean(data['name'], MAX.name),
          company: clean(data['company'], MAX.company),
          scope: clean(data['scope'], MAX.scope),
          message: String(data['message'] ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, MAX.message),
          checklist: clean(data['checklist'], MAX.checklist),
          source: clean(data['source'], MAX.source),
          website: undefined as string | undefined,
          status: 'new',
        }
        const missing = (REQUIRED[form] ?? []).filter((field) => !(next as Record<string, unknown>)[field])
        if (missing.length) throw new APIError(`Missing required field(s): ${missing.join(', ')}`, 400)
        const since = new Date(Date.now() - RATE_LIMIT_MS).toISOString()
        const recent = await req.payload.count({
          collection: 'form-submission',
          overrideAccess: true,
          where: { and: [{ email: { equals: next.email } }, { form: { equals: form } }, { createdAt: { greater_than: since } }] },
        })
        if (recent.totalDocs > 0) throw new APIError('Please wait a moment before submitting again', 429)
        return next
      },
    ],
  },
  fields: [
    { name: 'form', type: 'text', required: true },
    { name: 'source', type: 'text' },
    { name: 'name', type: 'text' },
    { name: 'email', type: 'email', required: true },
    { name: 'company', type: 'text' },
    { name: 'scope', type: 'text' },
    { name: 'message', type: 'textarea' },
    { name: 'checklist', type: 'text' },
    { name: 'data', type: 'json' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Read', value: 'read' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'archivedAt', type: 'date', admin: { position: 'sidebar', readOnly: true } },
    { name: 'website', type: 'text', admin: { hidden: true } },
  ],
}

import { APIError, type CollectionConfig } from 'payload'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Leads collected from the website forms (engagement enquiry, checklist gate,
 * subscribe). Anyone can create a row; only signed-in CMS users can read them.
 */
export const FormSubmission: CollectionConfig = {
  slug: 'form-submission',
  labels: { singular: 'Form Submission', plural: 'Form Submissions' },
  admin: {
    useAsTitle: 'email',
    group: 'Form Submissions',
    defaultColumns: ['email', 'form', 'name', 'company', 'status', 'createdAt'],
    listSearchableFields: ['email', 'name', 'company', 'form'],
    description: 'Submissions from the website forms. New ones are counted on the dashboard.',
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
      // Permanently deletes submissions archived more than 60 days ago (called by the notification bell).
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
    beforeValidate: [
      ({ data, operation }) => {
        if (operation !== 'create' || !data) return data
        // Honeypot: real visitors never see or fill this field.
        if (typeof data['website'] === 'string' && data['website'].trim() !== '') {
          throw new APIError('Invalid submission', 400)
        }
        if (typeof data['email'] !== 'string' || !EMAIL.test(data['email'].trim())) {
          throw new APIError('A valid email address is required', 400)
        }
        return { ...data, email: data['email'].trim(), website: undefined, status: 'new' }
      },
    ],
  },
  fields: [
    { name: 'form', type: 'text', required: true, admin: { description: 'Which form: engagement, checklist, subscribe or consultation (filter the list by this)' } },
    { name: 'source', type: 'text', admin: { description: 'Page the form was submitted from' } },
    { name: 'name', type: 'text' },
    { name: 'email', type: 'email', required: true },
    { name: 'company', type: 'text' },
    { name: 'scope', type: 'text' },
    { name: 'message', type: 'textarea' },
    { name: 'checklist', type: 'text', admin: { description: 'Checklist slug (checklist gate only)' } },
    { name: 'data', type: 'json', admin: { description: 'Every submitted field, as sent' } },
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
    { name: 'archivedAt', type: 'date', admin: { position: 'sidebar', readOnly: true, description: 'Set when archived; archived submissions are deleted permanently after 60 days.' } },
    // Honeypot (never stored; rejected in the hook when filled).
    { name: 'website', type: 'text', admin: { hidden: true } },
  ],
}

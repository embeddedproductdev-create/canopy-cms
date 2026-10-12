import type { CollectionConfig, Field } from 'payload'
import { formatSlug } from '../utilities/formatSlug'
import { seoGroupField } from './seo'
import { revalidateOnChange, revalidateOnDelete } from '../hooks/revalidate'
import { normalizeUrl } from '../hooks/normalizeUrl'

const urlField = { hooks: { beforeValidate: [normalizeUrl] } }

export const detailAccess: CollectionConfig['access'] = {
  create: ({ req: { user } }) => !!user,
  read: () => true,
  update: ({ req: { user } }) => !!user,
  delete: ({ req: { user } }) => user?.role === 'admin',
}

export const detailHooks: CollectionConfig['hooks'] = {
  afterChange: [revalidateOnChange],
  afterDelete: [revalidateOnDelete],
}

const ctaGroup = (name: string, label: string): Field => ({
  name,
  type: 'group',
  label,
  fields: [
    { name: 'label', type: 'text' },
    { name: 'href', type: 'text', label: 'URL', ...urlField, admin: { placeholder: '#consultation, /path, https://…' } },
  ],
})

export const heroFields: Field[] = [
  { name: 'title', type: 'text', required: true, admin: { description: 'Internal name (also used in menus and breadcrumbs).' } },
  {
    name: 'slug',
    type: 'text',
    unique: true,
    required: true,
    admin: { description: 'URL part, e.g. "pcb-design" → /capabilities/pcb-design/' },
    hooks: {
      beforeValidate: [
        ({ value, data }) => {
          if (value) return formatSlug(value)
          if (data && 'title' in data) return formatSlug(data.title as string)
          return value
        },
      ],
    },
  },
  { name: 'eyebrow', type: 'text', admin: { description: 'Small label above the heading.' } },
  { name: 'heading', type: 'text', admin: { description: 'Page heading (H1).' } },
  { name: 'subheading', type: 'textarea', admin: { description: 'Lead paragraph under the heading.' } },
  ctaGroup('cta', 'Primary button'),
  ctaGroup('secondaryCta', 'Secondary button'),
  { name: 'image', type: 'upload', relationTo: 'media', label: 'Hero image (optional)' },
  { name: 'imageAlt', type: 'text' },
]

export const stacksField: Field = {
  name: 'stacks',
  type: 'array',
  label: 'Technical stack blocks',
  admin: { description: 'Silicon / protocols / standards / materials blocks, shown in this order.' },
  fields: [
    {
      name: 'kind',
      type: 'select',
      defaultValue: 'rows',
      options: [
        { label: 'Logo strip (comma separated names)', value: 'logos' },
        { label: 'Tag chips (comma separated)', value: 'chips' },
        { label: 'Rows (one line: Label: item, item)', value: 'rows' },
        { label: 'Cards (one line: Title | text)', value: 'cards' },
      ],
    },
    { name: 'heading', type: 'text', admin: { description: 'Leave empty to continue the block above.' } },
    { name: 'intro', type: 'textarea' },
    { name: 'items', type: 'textarea', required: true },
    { name: 'note', type: 'text', admin: { description: 'Small print under the block (optional).' } },
    { name: 'tinted', type: 'checkbox', label: 'Grey background band', defaultValue: false },
  ],
}

export const faqsField: Field = {
  name: 'faqs',
  type: 'array',
  label: 'FAQ',
  fields: [
    { name: 'question', type: 'text', required: true },
    { name: 'answer', type: 'textarea', required: true },
  ],
}

export { seoGroupField }

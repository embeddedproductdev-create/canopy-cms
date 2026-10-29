import type { CollectionConfig, Field } from 'payload'
import { formatSlug } from '../utilities/formatSlug'
import { seoGroupField } from './seo'
import { contentAccess } from '../access'
import { revalidateOnChange, revalidateOnDelete } from '../hooks/revalidate'
import { captureOwnSections, removeReferences } from '../utilities/removeReferences'

export const detailAccess: CollectionConfig['access'] = contentAccess

export const detailHooks = (collection: 'capability' | 'industry'): CollectionConfig['hooks'] => ({
  afterChange: [revalidateOnChange],
  beforeDelete: [captureOwnSections(collection)],
  afterDelete: [removeReferences(collection), revalidateOnDelete],
})

export const identityFields: Field[] = [
  { name: 'title', type: 'text', required: true },
  {
    name: 'slug',
    type: 'text',
    unique: true,
    required: true,
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
  { name: 'heading', type: 'text' },
  { name: 'subheading', type: 'textarea' },
  { name: 'summary', type: 'text' },
]

export const serviceContentFields: Field[] = [
  { name: 'eyebrow', type: 'text', admin: { description: 'Small label above the page heading.' } },
  {
    name: 'cta',
    type: 'group',
    label: 'Primary call to action',
    fields: [
      { name: 'label', type: 'text' },
      { name: 'href', type: 'text', label: 'URL' },
    ],
  },
  {
    name: 'secondaryCta',
    type: 'group',
    label: 'Secondary call to action',
    fields: [
      { name: 'label', type: 'text' },
      { name: 'href', type: 'text', label: 'URL' },
    ],
  },
  { name: 'image', type: 'upload', relationTo: 'media', label: 'Hero image' },
  { name: 'imageAlt', type: 'text', label: 'Hero image description' },
  {
    name: 'heroImageFit',
    type: 'select',
    label: 'Hero image fit',
    defaultValue: 'contain',
    options: [
      { label: 'Show whole image (recommended)', value: 'contain' },
      { label: 'Fill the space (may crop edges)', value: 'cover' },
    ],
    admin: { description: 'Recommended upload: about 1200 x 1200 px PNG/WebP, subject centred, transparent background allowed.' },
  },
  {
    name: 'heroImageAlign',
    type: 'select',
    label: 'Hero image position',
    defaultValue: 'center',
    options: [
      { label: 'Centre', value: 'center' },
      { label: 'Sit on the bottom edge', value: 'bottom' },
    ],
  },
]

export const stacksField: Field = {
  name: 'stacks',
  type: 'array',
  label: 'Technology and materials',
  admin: { description: 'Add each technology block in display order.' },
  fields: [
    {
      name: 'kind',
      type: 'select',
      defaultValue: 'rows',
      options: [
        { label: 'Logo strip', value: 'logos' },
        { label: 'Tag chips', value: 'chips' },
        { label: 'Rows', value: 'rows' },
        { label: 'Cards', value: 'cards' },
      ],
    },
    { name: 'heading', type: 'text' },
    { name: 'intro', type: 'textarea' },
    { name: 'items', type: 'textarea', required: true, admin: { description: 'One item per line. Rows: Label: item, item. Cards: Title | text.' } },
    { name: 'note', type: 'text' },
    { name: 'tinted', type: 'checkbox', label: 'Use a grey background band', defaultValue: false },
  ],
}

export const faqsField: Field = {
  name: 'faqs',
  type: 'array',
  label: 'Frequently asked questions',
  fields: [
    { name: 'question', type: 'text', required: true },
    { name: 'answer', type: 'textarea', required: true },
  ],
}

export const layoutSectionsField: Field = {
  name: 'layoutSections',
  type: 'relationship',
  relationTo: 'section',
  hasMany: true,
  label: 'Layout Sections',
  admin: { hidden: true },
}

export { seoGroupField }

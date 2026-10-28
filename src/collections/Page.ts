import type { CollectionConfig } from 'payload'
import { contentAccess } from '../access'
import { formatSlug, formatUrlPath } from '../utilities/formatSlug'
import { seoGroupField } from '../fields/seo'
import { urlField } from '../hooks/normalizeUrl'
import { revalidateOnChange, revalidateOnDelete } from '../hooks/revalidate'

export const Page: CollectionConfig = {
  slug: 'page',
  labels: { singular: 'Page', plural: 'Pages' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'url', 'pageType', 'updatedAt'],
    group: 'Content Management',
  },
  access: contentAccess,
  hooks: {
    afterChange: [revalidateOnChange],
    afterDelete: [revalidateOnDelete],
  },
  versions: {
    drafts: true,
    maxPerDoc: 3,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'heading', type: 'text' },
    { name: 'subheading', type: 'text' },
    { name: 'eyebrow', type: 'text' },
    { name: 'pageType', type: 'text' },
    {
      name: 'url',
      type: 'text',
      required: true,
      label: 'URL',
      unique: true,
      hooks: {
        beforeValidate: [
          ({ value, data }) => {
            if (value) return formatUrlPath(value)
            if (data && 'title' in data) return `/${formatSlug(data.title as string)}/`
            return value
          },
        ],
      },
    },
    { name: 'heroImage', type: 'upload', relationTo: 'media' },
    { name: 'body', type: 'richText' },
    {
      name: 'cta',
      type: 'group',
      label: 'Page Call to Action',
      fields: [
        { name: 'label', type: 'text' },
        { name: 'href', type: 'text', label: 'URL', ...urlField },
      ],
    },
    {
      name: 'pills',
      type: 'array',
      label: 'Eyebrow Pills',
      admin: { initCollapsed: true },
      fields: [{ name: 'label', type: 'text', label: 'Label', required: true }],
    },
    {
      name: 'layoutSections',
      type: 'relationship',
      relationTo: 'section',
      hasMany: true,
      label: 'Layout Sections',
    },
    seoGroupField,
  ],
}

import type { CollectionConfig } from 'payload'
import { section } from '../fields/sections'
import { contentAccess } from '../access'
import { formatSlug } from '../utilities/formatSlug'
import { seoGroupField } from '../fields/seo'
import { revalidateOnChange, revalidateOnDelete } from '../hooks/revalidate'
import { contentTransferEndpoints } from '../utilities/contentTransfer'

export const Blog: CollectionConfig = {
  slug: 'blog',
  labels: { singular: 'Insight', plural: 'Insights' },
  admin: {
    components: { beforeList: ['/components/admin/ContentTransferButtons'] },
    useAsTitle: 'title',
    group: 'Content Management',
  },
  access: contentAccess,
  hooks: {
    afterChange: [revalidateOnChange],
    afterDelete: [revalidateOnDelete],
  },
  endpoints: contentTransferEndpoints('blog'),
  versions: {
    drafts: true,
    maxPerDoc: 3,
  },
  fields: [
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
    section('article', 'Article', [
      { name: 'category', type: 'text' },
      {
        name: 'featured',
        type: 'checkbox',
        defaultValue: false,
        label: 'Featured article',
      },
      {
        name: 'teaser',
        type: 'text',
        label: 'Teaser',
        admin: {
          placeholder: 'One-line summary for index pages and cards',
        },
      },
      {
        name: 'byline',
        type: 'text',
        admin: {
          placeholder: 'e.g., Canopy Embedded Labs engineering team',
        },
      },
      { name: 'publishedAt', type: 'date', required: true },
      {
        name: 'tags',
        type: 'text',
        label: 'Tags (Comma Separated)',
      },
    ]),
    section('cover', 'Cover image', [
      {
        name: 'image',
        type: 'upload',
        relationTo: 'media',
        label: 'Article Image',
      },
    ]),
    {
      name: 'meta',
      type: 'group',
      fields: [
        { name: 'title', type: 'text', label: 'Meta title' },
        { name: 'description', type: 'textarea', label: 'Meta description' },
      ],
    },
    {
      name: 'content',
      type: 'textarea',
      required: true,
      label: 'Content (Markdown)',
      admin: {
        description: 'Markdown body with H2 headings, paragraphs, lists, tables, and links. Tables pasted from Word or Google Docs are converted automatically. Do not add an H1.',
        components: { afterInput: ['/components/admin/PasteTables'] },
      },
    },
    { name: 'heading', type: 'text', admin: { hidden: true } },
    { name: 'dek', type: 'text', admin: { hidden: true } },
    { name: 'publishedDate', type: 'date', admin: { hidden: true } },
    { name: 'updatedDate', type: 'date', admin: { hidden: true } },
    { name: 'body', type: 'richText', admin: { hidden: true } },
    {
      name: 'contentUpgrade',
      type: 'group',
      label: 'Content upgrade',
      admin: { hidden: true },
      fields: [
        { name: 'label', type: 'text', label: 'Callout heading' },
        { name: 'checklistLink', type: 'relationship', relationTo: 'checklist', label: 'Linked checklist' },
      ],
    },
    {
      name: 'layoutSections',
      type: 'relationship',
      relationTo: 'section',
      hasMany: true,
      label: 'Legacy layout sections',
      admin: { hidden: true },
    },
    { ...seoGroupField, admin: { ...seoGroupField.admin, hidden: true } },
  ],
}

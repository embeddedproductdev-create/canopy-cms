import type { CollectionConfig } from 'payload'
import { urlField } from '../hooks/normalizeUrl'
import { formatSlug } from '../utilities/formatSlug'
import { seoGroupField } from '../fields/seo'
import { revalidateOnChange, revalidateOnDelete } from '../hooks/revalidate'

export const CaseStudy: CollectionConfig = {
  slug: 'case-study',
  labels: { singular: 'Portfolio project', plural: 'Portfolio' },
  admin: { useAsTitle: 'title', group: 'Content Management' },
  access: {
    create: ({ req: { user } }) => !!user,
    read: () => true,
    update: ({ req: { user } }) => !!user,
  },
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
    { name: 'subheading', type: 'text' },
    { name: 'category', type: 'text' },
    {
      name: 'featured',
      type: 'checkbox',
      label: 'Featured Project',
      defaultValue: false,
    },
    { name: 'body', type: 'richText' },
    {
      name: 'tags',
      type: 'text',
      label: 'Tags/Keywords (Comma Separated)',
      admin: {
        placeholder: 'e.g. Featured, Hardware, Sale, New-Arrival',
      },
    },
    {
      name: 'Images',
      type: 'group',
      fields: [
        {
          name: 'landingImage',
          type: 'upload',
          relationTo: 'media',
          required: false,
          label: 'Landing Image (Single)',
        },

      ],
    },
    {
      name: 'cardCta',
      type: 'group',
      label: 'Card Call to Action',
      fields: [
        {
          name: 'label',
          type: 'text',
          label: 'CTA Label',
        },
        {
          name: 'link',
          type: 'text',
          label: 'CTA URL',
          ...urlField,
        },
      ],
    },
    {
      name: 'pageCta',
      type: 'group',
      label: 'Page Call to Action',
      fields: [
        {
          name: 'label',
          type: 'text',
          label: 'CTA Label',
        },
        {
          name: 'link',
          type: 'text',
          label: 'CTA URL',
          ...urlField,
        },
      ],
    },
    {
      name: 'projectStage',
      type: 'select',
      label: 'Project Stage',
      options: [
        { label: 'In Design', value: 'in-design' },
        { label: 'Proto Built', value: 'proto-built' },
        { label: 'Shipped', value: 'shipped' },
      ],
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

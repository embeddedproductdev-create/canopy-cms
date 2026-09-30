import type { CollectionConfig } from 'payload'
import { formatSlug } from '../utilities/formatSlug'
import { seoGroupField } from '../fields/seo'
import { revalidateOnChange, revalidateOnDelete } from '../hooks/revalidate'

export const CaseStudy: CollectionConfig = {
  slug: 'case-study',
  labels: { singular: 'Case Study', plural: 'Case Studies' },
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

        {
          name: 'pageImages',
          type: 'array',
          admin: {
            initCollapsed: true,
          },
          fields: [
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              required: true,
              label: 'Select Image',
            },
          ],
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
          label: 'CTA Link',
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
          label: 'CTA Link',
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
      admin: {
        description: 'Visual badge displayed on the project',
      },
    },
    {
      name: 'atAGlance',
      type: 'array',
      label: 'At a Glance (Specs)',
      admin: {
        description: 'Quick specs/highlights (e.g., "20A/30A burst", "100W/channel")',
      },
      fields: [
        { name: 'label', type: 'text', label: 'Label', required: true },
        { name: 'value', type: 'text', label: 'Value', required: true },
      ],
    },
    {
      name: 'features',
      type: 'array',
      label: 'Features',
      fields: [{ name: 'item', type: 'text', label: 'Feature', required: true }],
    },
    {
      name: 'technicalSpecifications',
      type: 'array',
      label: 'Technical Specifications',
      fields: [{ name: 'item', type: 'text', label: 'Spec', required: true }],
    },
    seoGroupField,
  ],
}

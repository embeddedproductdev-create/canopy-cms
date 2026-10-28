import type { CollectionConfig } from 'payload'
import { section } from '../fields/sections'
import { contentAccess } from '../access'
import { urlField } from '../hooks/normalizeUrl'
import { formatSlug } from '../utilities/formatSlug'
import { seoGroupField } from '../fields/seo'
import { revalidateOnChange, revalidateOnDelete } from '../hooks/revalidate'
import { contentTransferEndpoints } from '../utilities/contentTransfer'

export const CaseStudy: CollectionConfig = {
  slug: 'case-study',
  labels: { singular: 'Portfolio project', plural: 'Portfolio' },
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
  endpoints: contentTransferEndpoints('case-study'),
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
    section('project', 'Overview', [
      { name: 'heading', type: 'text' },
      { name: 'subheading', type: 'text' },
      { name: 'category', type: 'text' },
      {
        name: 'featured',
        type: 'checkbox',
        label: 'Featured Project',
        defaultValue: false,
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
        name: 'overview',
        type: 'array',
        label: 'Project overview',
        fields: [
          { name: 'label', type: 'text', required: true },
          { name: 'text', type: 'textarea' },
        ],
      },
      {
        name: 'tags',
        type: 'text',
        label: 'Tags/Keywords (Comma Separated)',
        admin: {
          placeholder: 'e.g. Featured, Hardware, Sale, New-Arrival',
        },
      },
    ]),
    {
      name: 'Images',
      type: 'group',
      fields: [
        {
          name: 'landingImage',
          type: 'upload',
          relationTo: 'media',
          required: false,
          label: 'Card and landing image',
        },
        {
          name: 'pageImages',
          type: 'array',
          label: 'Page images',
          admin: { initCollapsed: true },
          fields: [
            { name: 'image', type: 'upload', relationTo: 'media', required: true, label: 'Image' },
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
    section('glance', 'At a glance', [
      {
        name: 'atAGlance',
        type: 'array',
        label: 'At a glance',
        fields: [
          { name: 'label', type: 'text', required: true },
          { name: 'value', type: 'text', required: true },
        ],
      },
    ]),
    section('specs', 'Specifications', [
      {
        name: 'specGroups',
        type: 'array',
        label: 'Technical specification groups',
        fields: [
          { name: 'heading', type: 'text', required: true },
          {
            name: 'rows',
            type: 'array',
            fields: [
              { name: 'label', type: 'text', required: true },
              { name: 'value', type: 'text' },
              { name: 'builtIn', type: 'checkbox', defaultValue: false },
            ],
          },
        ],
      },
    ]),
    section('content', 'Body', [
      { name: 'body', type: 'richText' },
    ]),
    {
      name: 'layoutSections',
      type: 'relationship',
      relationTo: 'section',
      hasMany: true,
      label: 'Legacy layout sections',
      admin: { hidden: true },
    },
    seoGroupField,
  ],
}

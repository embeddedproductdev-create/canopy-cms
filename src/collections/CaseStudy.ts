import type { CollectionConfig } from 'payload'
import { section } from '../fields/sections'
import { contentAccess } from '../access'
import { urlField } from '../hooks/normalizeUrl'
import { formatSlug } from '../utilities/formatSlug'
import { seoGroupField } from '../fields/seo'
import { revalidateOnChange, revalidateOnDelete } from '../hooks/revalidate'
import { captureOwnSections, removeReferences } from '../utilities/removeReferences'
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
    beforeDelete: [captureOwnSections('case-study')],
    afterDelete: [removeReferences('case-study'), revalidateOnDelete],
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
    section('features', 'Features', [
      { name: 'heading', type: 'text' },
      { name: 'intro', type: 'textarea' },
      {
        name: 'items',
        type: 'array',
        label: 'Feature list',
        fields: [{ name: 'text', type: 'text', required: true }],
      },
    ]),
    section('specs', 'Specifications', [
      { name: 'heading', type: 'text', admin: { placeholder: 'e.g. Technical specifications' } },
      { name: 'intro', type: 'textarea' },
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
    section('gap', 'Engineering gap', [
      { name: 'heading', type: 'text' },
      {
        name: 'cards',
        type: 'array',
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'text', type: 'textarea' },
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

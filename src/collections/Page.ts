import type { CollectionConfig } from 'payload'
import { formatSlug, formatUrlPath } from '../utilities/formatSlug'
import { seoGroupField } from '../fields/seo'
import { urlField } from '../hooks/normalizeUrl'
import { revalidateOnChange, revalidateOnDelete } from '../hooks/revalidate'

export const Page: CollectionConfig = {
  slug: 'page',
  labels: { singular: 'Page', plural: 'Pages' },
  admin: {
    useAsTitle: 'title',
    group: 'Content Management',
    description: 'Core website pages with custom layouts and sections',
  },
  access: {
    create: ({ req: { user } }) => !!user,
    read: () => true,
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) => user?.role === 'admin',
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
    { name: 'heading', type: 'text' },
    { name: 'subheading', type: 'text' },
    { name: 'eyebrow', type: 'text', admin: { description: 'Small label above the page heading' } },
    {
      name: 'pageType',
      type: 'text',
      admin: { description: 'landing, capability, industry … add the word left for a left-aligned header (free text)' },
    },
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
    { name: 'heroImage', type: 'upload', relationTo: 'media', admin: { description: 'Wide picture under the page heading (About page). Leave empty to keep an empty frame.' } },
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
      name: 'layoutSections',
      type: 'relationship',
      relationTo: 'section',
      hasMany: true,
      label: 'Page Layout Sections',
    },
    {
      name: 'pills',
      type: 'array',
      label: 'Eyebrow Pills',
      admin: {
        description: 'Pill-shaped tags above the main heading',
      },
      fields: [{ name: 'label', type: 'text', label: 'Label', required: true }],
    },
    {
      name: 'cards',
      type: 'relationship',
      relationTo: 'card',
      hasMany: true,
      label: 'Page Cards',
      admin: {
        hidden: true,
        description: 'Discipline cards, feature cards, or other card types',
      },
    },
    {
      name: 'faqs',
      admin: { hidden: true },
      type: 'array',
      label: 'FAQ Section',
      fields: [
        { name: 'question', type: 'text', label: 'Question', required: true },
        { name: 'answer', type: 'textarea', label: 'Answer', required: true },
      ],
    },
    {
      name: 'workflowSteps',
      admin: { hidden: true },
      type: 'array',
      label: 'Workflow / Process Steps',
      fields: [
        {
          name: 'stepNumber',
          type: 'number',
          label: 'Step Number',
          required: true,
        },
        { name: 'title', type: 'text', label: 'Title', required: true },
        { name: 'description', type: 'textarea', label: 'Description' },
      ],
    },
    {
      name: 'relatedCaseStudies',
      type: 'relationship',
      relationTo: 'case-study',
      hasMany: true,
      label: 'Related Case Studies / Projects',
    },
    {
      name: 'teamMembers',
      type: 'array',
      label: 'Team Members',
      admin: {
        hidden: true,
        description: 'For About page team grid',
      },
      fields: [
        { name: 'name', type: 'text', label: 'Name', required: true },
        { name: 'role', type: 'text', label: 'Role / Title', required: true },
        { name: 'bio', type: 'textarea', label: 'Bio' },
        { name: 'photo', type: 'upload', relationTo: 'media', label: 'Photo' },
      ],
    },
    {
      name: 'companyFacts',
      admin: { hidden: true },
      type: 'group',
      label: 'Company Facts',
      fields: [
        { name: 'name', type: 'text', label: 'Company Name' },
        { name: 'location', type: 'text', label: 'Location' },
        {
          name: 'sectors',
          type: 'array',
          label: 'Sectors / Industries',
          fields: [{ name: 'sector', type: 'text', required: true }],
        },
        {
          name: 'contactEmail',
          type: 'text',
          label: 'Contact Email',
        },
      ],
    },
    seoGroupField,
  ],
}

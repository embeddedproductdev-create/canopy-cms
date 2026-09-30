import type { CollectionConfig } from 'payload'

export const Section: CollectionConfig = {
  slug: 'section',
  labels: { singular: 'Section', plural: 'Sections' },
  admin: {
    useAsTitle: 'title',
    group: 'Content Management',
  },
  access: {
    create: ({ req: { user } }) => !!user,
    read: () => true,
    update: ({ req: { user } }) => !!user,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'sectionKey', type: 'text' },
    { name: 'heading', type: 'text' },
    { name: 'headingFirstLine', type: 'text' },
    { name: 'headingSecondLine', type: 'text' },
    { name: 'subheading', type: 'text' },
    { name: 'summary', type: 'textarea' },
    { name: 'eyebrow', type: 'text' },
    { name: 'tagLine', type: 'text' },
    { name: 'highlight', type: 'text' },
    { name: 'type', type: 'text' },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Section Image / Card Illustration',
    },
    { name: 'imageUrl', type: 'text', label: 'Section Image URL / Path' },
    { name: 'logo', type: 'text' },
    { name: 'imageAlt', type: 'text' },
    { name: 'backgroundImage', type: 'text' },
    { name: 'backgroundVideo', type: 'text' },
    { name: 'previewAlt', type: 'text' },
    {
      name: 'mockup',
      type: 'group',
      fields: [
        { name: 'assistantName', type: 'text' },
        { name: 'schedulingMessage', type: 'text' },
        {
          name: 'timeSlots',
          type: 'array',
          fields: [{ name: 'value', type: 'text' }],
        },
        { name: 'syncTitle', type: 'text' },
        { name: 'telemetryTitle', type: 'text' },
        {
          name: 'telemetryMetrics',
          type: 'array',
          fields: [{ name: 'value', type: 'text' }],
        },
      ],
    },
    {
      name: 'imageLabels',
      type: 'array',
      fields: [{ name: 'label', type: 'text' }],
    },
    { name: 'body', type: 'richText' },
    {
      name: 'cta',
      type: 'group',
      fields: [
        { name: 'label', type: 'text' },
        { name: 'href', type: 'text' },
      ],
    },
    {
      name: 'secondaryCta',
      type: 'group',
      fields: [
        { name: 'label', type: 'text' },
        { name: 'href', type: 'text' },
      ],
    },
    {
      name: 'controls',
      type: 'group',
      fields: [
        { name: 'tabsLabel', type: 'text' },
        { name: 'previousLabel', type: 'text' },
        { name: 'nextLabel', type: 'text' },
      ],
    },
    {
      name: 'categories',
      type: 'array',
      fields: [{ name: 'category', type: 'text' }],
    },
    {
      name: 'cards',
      type: 'relationship',
      relationTo: 'card',
      hasMany: true,
      label: 'Related Cards / Points',
    },
  ],
}

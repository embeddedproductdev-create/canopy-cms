import type { CollectionConfig } from 'payload'

export const Card: CollectionConfig = {
  slug: 'card',
  labels: { singular: 'Card', plural: 'Cards' },
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
    { name: 'heading', type: 'text' },
    { name: 'subheading', type: 'text' },
    { name: 'category', type: 'text' },
    { name: 'image', type: 'upload', relationTo: 'media' },
    { name: 'description', type: 'richText' },
    { name: 'additionalDescription', type: 'richText' },
    { name: 'ctaLabel', type: 'text', label: 'CTA Label' },
    { name: 'ctaUrl', type: 'text', label: 'CTA URL' },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'grid', value: 'grid' },
        { label: 'gaint', value: 'gaint' },
        { label: 'layout', value: 'layout' },
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
  ],
}

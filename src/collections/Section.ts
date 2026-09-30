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
    { name: 'heading', type: 'text' },
    { name: 'subheading', type: 'text' },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Section Image / Card Illustration',
    },
    { name: 'body', type: 'richText' },
    {
      name: 'cards',
      type: 'relationship',
      relationTo: 'card',
      hasMany: true,
      label: 'Related Cards / Points',
    },
    { name: 'constant', type: 'json' },
  ],
}

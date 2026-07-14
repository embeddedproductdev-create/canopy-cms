import type { CollectionConfig } from 'payload'

export const Page: CollectionConfig = {
  slug: 'page',
  labels: { singular: 'Page', plural: 'Pages' },
  admin: {
    useAsTitle: 'title',
    group: 'Content Management',
  },
  access: {
    create: ({ req: { user } }) => !!user,
    read: () => true,
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'heading', type: 'text' },
    { name: 'subheading', type: 'text' },
    {
      name: 'url',
      type: 'text',
      required: true,
      label: 'URL',
    },
    { name: 'body', type: 'richText' },
    { name: 'constant', type: 'json' },
    {
      name: 'layoutSections',
      type: 'relationship',
      relationTo: 'section',
      hasMany: true,
      label: 'Page Layout Sections',
    },
  ],
}

import type { CollectionConfig } from 'payload'
import { revalidateOnChange, revalidateOnDelete } from '../hooks/revalidate'

export const Testimonial: CollectionConfig = {
  slug: 'testimonial',
  labels: { singular: 'Testimonial', plural: 'Testimonials' },
  admin: {
    useAsTitle: 'heading',
    group: 'Content Management',
    defaultColumns: ['heading', 'clientLabel', 'order'],
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
  fields: [
    { name: 'heading', type: 'text', required: true },
    {
      name: 'clientLabel',
      type: 'text',
      label: 'Client Label',
      defaultValue: 'Canopy client',
      admin: {
        description: 'e.g. "Canopy client" or "CTO, Acme Corp"',
      },
    },
    { name: 'quote', type: 'textarea', required: true },
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Display order on the site (ascending)' },
    },
  ],
}

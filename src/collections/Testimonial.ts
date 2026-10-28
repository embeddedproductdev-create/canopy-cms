import type { CollectionConfig } from 'payload'
import { contentAccess } from '../access'
import { revalidateOnChange, revalidateOnDelete } from '../hooks/revalidate'

export const Testimonial: CollectionConfig = {
  slug: 'testimonial',
  labels: { singular: 'Testimonial', plural: 'Testimonials' },
  admin: {
    useAsTitle: 'heading',
    group: 'Testimonials',
    defaultColumns: ['heading', 'clientLabel', 'order'],
  },
  access: contentAccess,
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
    },
    { name: 'quote', type: 'textarea', required: true },
    {
      name: 'order',
      type: 'number',
      defaultValue: 0,
    },
  ],
}

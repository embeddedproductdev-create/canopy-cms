import type { CollectionConfig } from 'payload'
import { urlField } from '../hooks/normalizeUrl'
import { cardKindOptions } from './sectionLayouts'

export const Card: CollectionConfig = {
  slug: 'card',
  labels: { singular: 'Card', plural: 'Cards' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'shortDescription'],
    group: 'Content Management',
  },
  access: {
    create: ({ req: { user } }) => !!user,
    read: () => true,
    update: ({ req: { user } }) => !!user,
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'title', type: 'text', required: true, admin: { width: '60%' } },
        { name: 'type', type: 'select', label: 'Kind', options: cardKindOptions, admin: { width: '40%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'subheading', type: 'text', label: 'Subtitle', admin: { width: '50%' } },
        { name: 'value', type: 'text', admin: { width: '50%' } },
      ],
    },
    { name: 'shortDescription', type: 'textarea' },
    { name: 'description', type: 'richText' },
    {
      type: 'row',
      fields: [
        { name: 'ctaLabel', type: 'text', label: 'Link Label', admin: { width: '33%' } },
        { name: 'ctaUrl', type: 'text', label: 'Link URL', ...urlField, admin: { width: '33%' } },
        { name: 'icon', type: 'text', admin: { width: '34%' } },
      ],
    },
    { name: 'tags', type: 'text', label: 'Tags (Comma Separated)' },
    { name: 'image', type: 'upload', relationTo: 'media' },
  ],
}

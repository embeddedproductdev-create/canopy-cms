import type { CollectionConfig } from 'payload'
import { urlField } from '../hooks/normalizeUrl'

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
    { name: 'index', type: 'text' },
    { name: 'value', type: 'text' },
    { name: 'category', type: 'text' },
    { name: 'role', type: 'text' },
    { name: 'date', type: 'text' },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Image',
    },
    {
      name: 'imageUrl',
      type: 'text',
      label: 'Legacy Image URL / Path',
      admin: { hidden: true },
    },
    { name: 'imageAlt', type: 'text' },
    { name: 'icon', type: 'text' },
    { name: 'theme', type: 'text' },
    { name: 'shortDescription', type: 'textarea' },
    { name: 'description', type: 'richText' },
    { name: 'additionalDescription', type: 'richText', admin: { hidden: true } },
    { name: 'body', type: 'textarea' },
    { name: 'ctaLabel', type: 'text', label: 'CTA Label' },
    { name: 'ctaUrl', type: 'text', label: 'CTA URL', ...urlField },
    { name: 'readMoreLabel', type: 'text' },
    { name: 'linkedinUrl', type: 'text' },
    { name: 'type', type: 'text' },
    {
      name: 'tags',
      type: 'text',
      label: 'Tags (Comma Separated)',
      admin: {
        placeholder: 'e.g. Hardware, Firmware, IoT',
      },
    },
  ],
}

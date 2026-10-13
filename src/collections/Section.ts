import type { CollectionConfig } from 'payload'
import { urlField } from '../hooks/normalizeUrl'
import { layoutFor, sectionTypeOptions, showsField, validateVariant } from './sectionLayouts'

export const Section: CollectionConfig = {
  slug: 'section',
  labels: { singular: 'Section', plural: 'Sections' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'variant', 'hidden'],
    group: 'Content Management',
  },
  access: {
    create: ({ req: { user } }) => !!user,
    read: () => true,
    update: ({ req: { user } }) => !!user,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'type', type: 'select', required: true, options: sectionTypeOptions, admin: { width: '50%' } },
        {
          name: 'variant',
          type: 'text',
          validate: validateVariant,
          admin: {
            width: '50%',
            condition: (data) => Object.keys(layoutFor(data?.type)?.variants ?? {}).length > 0,
          },
        },
      ],
    },
    { name: 'eyebrow', type: 'text', admin: { condition: showsField('eyebrow') } },
    { name: 'heading', type: 'text', admin: { condition: showsField('heading') } },
    { name: 'subheading', type: 'text', admin: { condition: showsField('subheading') } },
    { name: 'body', type: 'richText', admin: { condition: showsField('body') } },
    {
      name: 'tags',
      type: 'text',
      label: 'Items (Comma Separated)',
      admin: { condition: showsField('items') },
    },
    {
      name: 'cta',
      type: 'group',
      label: 'Button',
      admin: { condition: showsField('cta') },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'label', type: 'text', admin: { width: '50%' } },
            { name: 'href', type: 'text', label: 'URL', ...urlField, admin: { width: '50%' } },
          ],
        },
      ],
    },
    {
      name: 'secondaryCta',
      type: 'group',
      label: 'Second button',
      admin: { condition: showsField('secondaryCta') },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'label', type: 'text', admin: { width: '50%' } },
            { name: 'href', type: 'text', label: 'URL', ...urlField, admin: { width: '50%' } },
          ],
        },
      ],
    },
    { name: 'image', type: 'upload', relationTo: 'media', admin: { condition: showsField('image') } },
    {
      name: 'cards',
      type: 'relationship',
      relationTo: 'card',
      hasMany: true,
      admin: { condition: showsField('cards') },
    },
    { name: 'sectionKey', type: 'text', admin: { position: 'sidebar' } },
    { name: 'anchor', type: 'text', admin: { position: 'sidebar' } },
    { name: 'hidden', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
  ],
}

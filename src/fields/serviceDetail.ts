import type { CollectionConfig, Field } from 'payload'
import { formatSlug } from '../utilities/formatSlug'
import { seoGroupField } from './seo'
import { revalidateOnChange, revalidateOnDelete } from '../hooks/revalidate'

export const detailAccess: CollectionConfig['access'] = {
  create: ({ req: { user } }) => !!user,
  read: () => true,
  update: ({ req: { user } }) => !!user,
  delete: ({ req: { user } }) => user?.role === 'admin',
}

export const detailHooks: CollectionConfig['hooks'] = {
  afterChange: [revalidateOnChange],
  afterDelete: [revalidateOnDelete],
}

export const identityFields: Field[] = [
  { name: 'title', type: 'text', required: true },
  {
    name: 'slug',
    type: 'text',
    unique: true,
    required: true,
    hooks: {
      beforeValidate: [
        ({ value, data }) => {
          if (value) return formatSlug(value)
          if (data && 'title' in data) return formatSlug(data.title as string)
          return value
        },
      ],
    },
  },
  { name: 'heading', type: 'text' },
  { name: 'subheading', type: 'textarea' },
  { name: 'summary', type: 'text' },
]

export const layoutSectionsField: Field = {
  name: 'layoutSections',
  type: 'relationship',
  relationTo: 'section',
  hasMany: true,
  label: 'Layout Sections',
}

export { seoGroupField }

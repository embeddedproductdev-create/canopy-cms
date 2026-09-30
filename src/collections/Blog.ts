import type { CollectionConfig } from 'payload'
import { formatSlug } from '../utilities/formatSlug'
import { seoGroupField } from '../fields/seo'
import { revalidateOnChange, revalidateOnDelete } from '../hooks/revalidate'

export const Blog: CollectionConfig = {
  slug: 'blog',
  labels: { singular: 'Blog', plural: 'Blogs' },
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
  hooks: {
    afterChange: [revalidateOnChange],
    afterDelete: [revalidateOnDelete],
  },
  versions: {
    drafts: true,
    maxPerDoc: 3,
  },
  fields: [
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
    { name: 'category', type: 'text' },
    {
      name: 'dek',
      type: 'text',
      label: 'Teaser/Description',
      admin: {
        placeholder: 'One-line summary for index pages and cards',
      },
    },
    {
      name: 'byline',
      type: 'text',
      admin: {
        placeholder: 'e.g., Canopy Embedded Labs engineering team',
      },
    },
    { name: 'publishedDate', type: 'date', required: true },
    { name: 'updatedDate', type: 'date' },
    { name: 'body', type: 'richText', required: true },
    {
      name: 'tags',
      type: 'array',
      label: 'Tags',
      admin: {
        description: 'Category-like tags for filtering/organization',
      },
      fields: [{ name: 'tag', type: 'text', label: 'Tag', required: true }],
    },
    {
      name: 'relatedLinks',
      type: 'array',
      label: 'Related Links (in article body)',
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
      ],
    },
    {
      name: 'contentUpgrade',
      type: 'group',
      label: 'Content Upgrade (CTA box at bottom)',
      fields: [
        {
          name: 'label',
          type: 'text',
          admin: {
            placeholder: 'e.g., Get the Checklist This Article Is Built On',
          },
        },
        {
          name: 'checklistLink',
          type: 'relationship',
          relationTo: 'checklist',
          label: 'Link to Checklist',
        },
      ],
    },
    seoGroupField,
  ],
}

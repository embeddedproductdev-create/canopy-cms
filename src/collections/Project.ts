import type { CollectionConfig } from 'payload'

export const formatSlug = (val: string): string =>
  val
    ? val
        .toLowerCase()
        .replace(/ /g, '-')
        .replace(/[^\w-]+/g, '')
    : ''

export const Project: CollectionConfig = {
  slug: 'project',
  admin: { useAsTitle: 'title', group: 'Content Management' },
  access: {
    create: ({ req: { user } }) => !!user,
    read: () => true,
    update: ({ req: { user } }) => !!user,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      unique: true,
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
    { name: 'subheading', type: 'text' },
    { name: 'category', type: 'text' },
    { name: 'body', type: 'richText' },
    {
      name: 'tags',
      type: 'text',
      label: 'Tags/Keywords (Comma Separated)',
      admin: {
        placeholder: 'e.g. Featured, Hardware, Sale, New-Arrival',
      },
    },
    {
      name: 'Images',
      type: 'group',
      fields: [
        {
          name: 'landingImage',
          type: 'upload',
          relationTo: 'media',
          required: false,
          label: 'Landing Image (Single)',
        },

        {
          name: 'pageImages',
          type: 'array',
          admin: {
            initCollapsed: true,
          },
          fields: [
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              required: true,
              label: 'Select Image',
            },
          ],
        },
      ],
    },
    {
      name: 'cardCta',
      type: 'group',
      label: 'Card Call to Action',
      fields: [
        {
          name: 'label',
          type: 'text',
          label: 'CTA Label',
        },
        {
          name: 'link',
          type: 'text',
          label: 'CTA Link',
        },
      ],
    },
    {
      name: 'pageCta',
      type: 'group',
      label: 'Page Call to Action',
      fields: [
        {
          name: 'label',
          type: 'text',
          label: 'CTA Label',
        },
        {
          name: 'link',
          type: 'text',
          label: 'CTA Link',
        },
      ],
    },
  ],
}

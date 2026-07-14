import type { GlobalConfig, Field } from 'payload'

const footerLinkFields: Field[] = [
  {
    name: 'type',
    type: 'select',
    required: true,
    defaultValue: 'internal',
    options: [
      { label: 'Internal Navigation', value: 'internal' },
      { label: 'Anchor Section (#)', value: 'anchor' },
      { label: 'External URL', value: 'external' },
    ],
  },
  {
    name: 'label',
    type: 'text',
    required: true,
  },
  {
    name: 'url',
    type: 'text',
    required: true,
  },
  {
    name: 'newTab',
    type: 'checkbox',
    label: 'Open in new tab',
    defaultValue: false,
    admin: {
      condition: (_, siblingData) => siblingData?.type === 'external',
    },
  },
]

export const Footer: GlobalConfig = {
  slug: 'footer',
  access: {
    read: ({ req: { user } }) => !!user,
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
  },
  fields: [
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'categories',
      type: 'array',
      label: 'Footer Columns / Categories',
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          label: 'Column Category Title',
        },
        {
          name: 'links',
          type: 'array',
          fields: footerLinkFields,
        },
      ],
    },
    {
      name: 'content',
      type: 'richText',
      label: 'Footer Rich Text Content',
    },
    {
      name: 'copyright',
      type: 'text',
      label: 'Copyright One-Liner Text',
      required: true,
    },
  ],
}

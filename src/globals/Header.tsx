import type { GlobalConfig, Field } from 'payload'

const baseLinkFields: Field[] = [
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

export const Header: GlobalConfig = {
  slug: 'header',
  access: {
    read: ({ req: { user } }) => !!user,
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
  },
  fields: [
    {
      name: 'primaryLogo',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'secondaryLogo',
      type: 'upload',
      relationTo: 'media',
      label: 'Secondary / Mobile Logo',
    },
    {
      name: 'navItems',
      type: 'array',
      label: 'Main Navigation Menu',
      fields: [
        ...baseLinkFields,
        {
          name: 'subMenuItems',
          type: 'array',
          label: 'Submenu Links',
          fields: [
            ...baseLinkFields,
            {
              name: 'nestedMenuItems',
              type: 'array',
              label: 'Submenu Links',
              fields: baseLinkFields,
            },
          ],
        },
      ],
    },
  ],
}

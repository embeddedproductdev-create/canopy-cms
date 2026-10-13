import type { GlobalConfig } from 'payload'
import { revalidateGlobalOnChange } from '../hooks/revalidate'
import { urlField } from '../hooks/normalizeUrl'

export const Header: GlobalConfig = {
  slug: 'header',
  label: 'Header',
  admin: {
    group: 'Globals',
  },
  access: {
    read: () => true,
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
  },
  hooks: {
    afterChange: [revalidateGlobalOnChange],
  },
  fields: [
    {
      name: 'primaryLogo',
      type: 'upload',
      relationTo: 'media',
      required: false,
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
        { name: 'label', type: 'text', required: true },
        { name: 'url', type: 'text', required: true, label: 'URL', ...urlField },
        {
          name: 'children',
          type: 'array',
          label: 'Dropdown Items',
          fields: [
            { name: 'label', type: 'text', required: true },
            { name: 'url', type: 'text', required: true, label: 'URL', ...urlField },
            { name: 'description', type: 'text' },
          ],
        },
      ],
    },
    {
      name: 'navCta',
      type: 'group',
      label: 'Navigation CTA Button',
      fields: [
        {
          name: 'label',
          type: 'text',
          label: 'Button Label',
          defaultValue: 'Book a Consultation',
        },
        {
          name: 'href',
          type: 'text',
          label: 'Button URL',
          ...urlField,
          defaultValue: '',
        },
      ],
    },
  ],
}

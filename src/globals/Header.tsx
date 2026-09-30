import type { GlobalConfig, Field } from 'payload'
import { revalidateGlobalOnChange } from '../hooks/revalidate'

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
      type: 'json',
      label: 'Main Navigation Menu',
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
          name: 'url',
          type: 'text',
          label: 'Button URL',
          defaultValue: '/engagement-model/',
        },
      ],
    },
  ],
}

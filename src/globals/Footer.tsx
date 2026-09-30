import type { GlobalConfig, Field } from 'payload'
import { revalidateGlobalOnChange } from '../hooks/revalidate'

export const Footer: GlobalConfig = {
  slug: 'footer',
  label: 'Footer',
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
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      required: false,
    },
    {
      name: 'content',
      type: 'json',
      label: 'Footer Content',
      admin: {
        description:
          'Free-form footer JSON (heading, subHeading, cta, linkGroups, contactInfo, copyright). Shape follows the frontend FooterContent model — new footer details need no schema change.',
      },
    },
  ],
}

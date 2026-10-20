import type { GlobalConfig } from 'payload'
import { revalidateGlobalOnChange } from '../hooks/revalidate'
import { linkGroupsField, socialLinksField } from './jsonFields'

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
    { name: 'heading', type: 'text', defaultValue: 'Canopy Embedded Labs' },
    { name: 'subHeading', type: 'text', defaultValue: 'Product engineering' },
    { name: 'homeLinkLabel', type: 'text', defaultValue: 'Canopy home' },
    {
      name: 'cta',
      type: 'group',
      fields: [
        { name: 'label', type: 'text' },
        { name: 'href', type: 'text', defaultValue: '' },
      ],
    },
    { name: 'socialNavLabel', type: 'text', defaultValue: 'Social media' },
    linkGroupsField,
    socialLinksField,
    { name: 'helplineNumber', type: 'text', defaultValue: '+1999 888-76-54' },
    { name: 'techSupportEmail', type: 'text', defaultValue: 'contact@canopyembedded.com' },
    { name: 'requestIntro', type: 'text', defaultValue: 'Raise a general' },
    { name: 'requestLabel', type: 'text', defaultValue: 'IT Support Requests' },
    { name: 'requestUrl', type: 'text', defaultValue: '' },
    {
      name: 'copyright',
      type: 'text',
      label: 'Copyright',
    },
  ],
}

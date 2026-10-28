import type { CollectionConfig } from 'payload'
import { contentAccess } from '../access'
import { formatSlug } from '../utilities/formatSlug'
import { seoGroupField } from '../fields/seo'
import { revalidateOnChange, revalidateOnDelete } from '../hooks/revalidate'
import { redactLockedItem } from '../hooks/redactLockedChecklist'

export const Checklist: CollectionConfig = {
  slug: 'checklist',
  labels: { singular: 'Checklist', plural: 'Checklists' },
  admin: {
    useAsTitle: 'title',
    group: 'Content Management',
  },
  access: contentAccess,
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data || !Array.isArray(data.items)) return data;
        const open = data.items.filter((item: { locked?: boolean }) => !item?.locked);
        data.visibleItems = open.slice(0, 3).map((item: { heading?: string }) => ({ item: item?.heading || "" }));
        data.lockedItemsCount = data.items.length - open.length;
        return data;
      },
    ],
    afterChange: [revalidateOnChange],
    afterDelete: [revalidateOnDelete],
  },
  versions: {
    drafts: true,
    maxPerDoc: 3,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Title (shown as a Checklist Modal option)',
    },
    { name: 'heading', type: 'text' },
    { name: 'subheading', type: 'textarea' },
    { name: 'introduction', type: 'textarea' },
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
    {
      name: 'itemsHeading',
      type: 'text',
      label: 'Checklist Section Heading',
    },
    {
      name: 'items',
      type: 'array',
      label: 'Checklist Items',
      admin: { initCollapsed: true },
      fields: [
        { name: 'number', type: 'text', required: true },
        {
          name: 'heading',
          type: 'text',
          admin: { description: 'Locked items are stored here but never sent to the public website.' },
          hooks: { afterRead: [redactLockedItem] },
        },
        { name: 'description', type: 'textarea', hooks: { afterRead: [redactLockedItem] } },
        { name: 'locked', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      name: 'visibleItems',
      type: 'array',
      label: 'Visible Items (1–3)',
      maxRows: 3,
      fields: [{ name: 'item', type: 'text', required: true }],
      admin: {
        hidden: true,
      },
    },
    {
      name: 'lockedItemsCount',
      type: 'number',
      label: 'Total Locked Items (4–10)',
      defaultValue: 7,
      admin: {
        hidden: true,
      },
    },
    {
      name: 'pdfAsset',
      type: 'upload',
      relationTo: 'media',
      label: 'PDF Download Link',
    },
    {
      name: 'layoutSections',
      type: 'relationship',
      relationTo: 'section',
      hasMany: true,
      label: 'Layout Sections',
    },
    seoGroupField,
  ],
}

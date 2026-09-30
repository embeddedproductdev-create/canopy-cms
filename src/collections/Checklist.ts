import type { CollectionConfig } from 'payload'
import { formatSlug } from '../utilities/formatSlug'
import { seoGroupField } from '../fields/seo'
import { revalidateOnChange, revalidateOnDelete } from '../hooks/revalidate'

export const Checklist: CollectionConfig = {
  slug: 'checklist',
  labels: { singular: 'Checklist', plural: 'Checklists' },
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
      fields: [
        { name: 'number', type: 'text', required: true },
        { name: 'heading', type: 'text', required: true },
        { name: 'description', type: 'textarea', required: true },
        { name: 'locked', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      name: 'accessGate',
      type: 'group',
      label: 'Checklist Access Gate',
      fields: [
        { name: 'heading', type: 'text' },
        { name: 'unlockedHeading', type: 'text' },
        { name: 'description', type: 'textarea' },
        { name: 'unlockedDescription', type: 'textarea' },
        { name: 'emailLabel', type: 'text' },
        { name: 'companyLabel', type: 'text' },
        { name: 'emailPlaceholder', type: 'text' },
        { name: 'emailHelper', type: 'text' },
        { name: 'companyPlaceholder', type: 'text' },
        { name: 'submitLabel', type: 'text' },
        { name: 'privacyNote', type: 'textarea' },
        { name: 'lockedActionLabel', type: 'text' },
        { name: 'progressConnector', type: 'text' },
        { name: 'progressSuffix', type: 'text' },
        { name: 'validationError', type: 'text' },
      ],
    },
    {
      name: 'visibleItems',
      type: 'array',
      label: 'Visible Items (1–3)',
      required: true,
      minRows: 1,
      maxRows: 3,
      fields: [{ name: 'item', type: 'text', required: true }],
      admin: {
        description: 'The first 3 checklist items shown on the page; items 4–10 are locked',
      },
    },
    {
      name: 'lockedItemsCount',
      type: 'number',
      label: 'Total Locked Items (4–10)',
      defaultValue: 7,
      admin: {
        description: 'How many items are hidden behind the form submission (usually 7 for a 10-item checklist)',
      },
    },
    {
      name: 'pdfAsset',
      type: 'upload',
      relationTo: 'media',
      label: 'PDF Download Link',
      admin: {
        description: 'PDF file for download (optional until the real PDF is ready)',
      },
    },
    {
      name: 'formId',
      type: 'text',
      label: 'Form ID',
      admin: {
        placeholder: 'e.g., form_hardware_audit_checklist',
        description: 'Form system ID for email capture + delivery',
      },
    },
    seoGroupField,
  ],
}

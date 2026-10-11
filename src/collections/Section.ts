import type { CollectionConfig } from 'payload'
import { urlField } from '../hooks/normalizeUrl'

export const Section: CollectionConfig = {
  slug: 'section',
  labels: { singular: 'Section', plural: 'Sections' },
  admin: {
    useAsTitle: 'title',
    group: 'Content Management',
  },
  access: {
    create: ({ req: { user } }) => !!user,
    read: () => true,
    update: ({ req: { user } }) => !!user,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'sectionKey', type: 'text' },
    { name: 'heading', type: 'text' },
    { name: 'headingFirstLine', type: 'text' },
    { name: 'headingSecondLine', type: 'text' },
    { name: 'subheading', type: 'text' },
    { name: 'summary', type: 'textarea' },
    { name: 'eyebrow', type: 'text' },
    { name: 'tagLine', type: 'text' },
    { name: 'highlight', type: 'text' },
    {
      name: 'type',
      type: 'text',
      admin: {
        description:
          'How the website renders this section: hero, text, cards, chips, table, steps, stats, faq, marquee, cta-band, media, tabs, pinned',
      },
    },
    {
      name: 'variant',
      type: 'text',
      admin: { description: 'Optional layout / tone hint, e.g. olive, surface, dark, nodes, columns' },
    },
    {
      name: 'columns',
      type: 'text',
      label: 'Columns (Comma Separated)',
      admin: {
        description: 'Table header labels, e.g. Specification, Details. Each linked card is one row.',
      },
    },
    {
      name: 'tags',
      type: 'text',
      label: 'Tags / Items (Comma Separated)',
      admin: { description: 'Chip list, marquee items or tab labels, e.g. Zigbee, Bluetooth, Wi-Fi' },
    },
    { name: 'anchor', type: 'text', admin: { description: 'Optional HTML id for in-page links' } },
    {
      name: 'hidden',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Tick to hide this section on the website without deleting it' },
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Section Image / Card Illustration',
    },
    {
      name: 'imageUrl',
      type: 'text',
      label: 'Legacy Section Image URL / Path',
      admin: { hidden: true },
    },
    {
      name: 'logoMedia',
      type: 'upload',
      relationTo: 'media',
      label: 'Logo Image',
    },
    {
      name: 'logo',
      type: 'text',
      label: 'Legacy Logo URL',
      admin: { hidden: true },
    },
    { name: 'imageAlt', type: 'text' },
    {
      name: 'backgroundImageMedia',
      type: 'upload',
      relationTo: 'media',
      label: 'Background Image',
    },
    {
      name: 'backgroundImage',
      type: 'text',
      label: 'Legacy Background Image URL',
      admin: { hidden: true },
    },
    {
      name: 'backgroundVideoMedia',
      type: 'upload',
      relationTo: 'media',
      label: 'Background Video',
    },
    {
      name: 'backgroundVideo',
      type: 'text',
      label: 'Legacy Background Video URL',
      admin: { hidden: true },
    },
    { name: 'previewAlt', type: 'text', admin: { hidden: true } },
    {
      name: 'mockup',
      admin: { hidden: true },
      type: 'group',
      fields: [
        { name: 'assistantName', type: 'text' },
        { name: 'schedulingMessage', type: 'text' },
        {
          name: 'timeSlots',
          type: 'array',
          fields: [{ name: 'value', type: 'text' }],
        },
        { name: 'syncTitle', type: 'text' },
        { name: 'telemetryTitle', type: 'text' },
        {
          name: 'telemetryMetrics',
          type: 'array',
          fields: [{ name: 'value', type: 'text' }],
        },
      ],
    },
    {
      name: 'imageLabels',
      admin: { hidden: true },
      type: 'array',
      fields: [{ name: 'label', type: 'text' }],
    },
    { name: 'body', type: 'richText' },
    {
      name: 'cta',
      type: 'group',
      fields: [
        { name: 'label', type: 'text' },
        { name: 'href', type: 'text', label: 'URL', ...urlField },
      ],
    },
    {
      name: 'secondaryCta',
      type: 'group',
      fields: [
        { name: 'label', type: 'text' },
        { name: 'href', type: 'text', label: 'URL', ...urlField },
      ],
    },
    {
      name: 'controls',
      admin: { hidden: true },
      type: 'group',
      fields: [
        { name: 'tabsLabel', type: 'text' },
        { name: 'previousLabel', type: 'text' },
        { name: 'nextLabel', type: 'text' },
      ],
    },
    {
      name: 'categories',
      admin: { hidden: true },
      type: 'array',
      fields: [{ name: 'category', type: 'text' }],
    },
    {
      name: 'cards',
      type: 'relationship',
      relationTo: 'card',
      hasMany: true,
      label: 'Related Cards / Points',
    },
  ],
}

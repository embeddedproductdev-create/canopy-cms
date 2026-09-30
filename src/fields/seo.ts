import type { Field } from 'payload'

export const seoFields: Field[] = [
  {
    name: 'seoTitle',
    type: 'text',
    label: 'SEO Title',
    admin: {
      placeholder: 'Browser tab / search results title (50-60 chars)',
    },
  },
  {
    name: 'metaDescription',
    type: 'text',
    label: 'Meta Description',
    admin: {
      placeholder: 'Search results snippet (150-160 chars)',
    },
  },
  {
    name: 'canonicalUrl',
    type: 'text',
    label: 'Canonical URL (optional)',
    admin: {
      placeholder: 'https://www.canopyembedded.com/path/ (leave blank for auto)',
    },
  },
  {
    name: 'robots',
    type: 'group',
    label: 'Robots Meta Tags',
    fields: [
      {
        name: 'index',
        type: 'checkbox',
        label: 'Index this page',
        defaultValue: true,
      },
      {
        name: 'follow',
        type: 'checkbox',
        label: 'Follow links on this page',
        defaultValue: true,
      },
    ],
  },
  {
    name: 'schemaType',
    type: 'select',
    label: 'Schema Type (structured data)',
    options: [
      { label: 'None', value: 'none' },
      { label: 'Organization', value: 'Organization' },
      { label: 'BreadcrumbList', value: 'BreadcrumbList' },
      { label: 'Service', value: 'Service' },
      { label: 'FAQPage', value: 'FAQPage' },
      { label: 'BlogPosting', value: 'BlogPosting' },
      { label: 'NewsArticle', value: 'NewsArticle' },
    ],
    defaultValue: 'none',
  },
]

export const seoGroupField: Field = {
  name: 'seo',
  type: 'group',
  label: 'SEO',
  fields: seoFields,
}

import type { GlobalConfig } from 'payload'

export const SeoSettings: GlobalConfig = {
  slug: 'seo-settings',
  label: 'SEO Settings',
  admin: {
    group: 'Globals',
  },
  access: {
    read: () => true,
    update: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Site Identity',
          fields: [
            {
              name: 'siteName',
              type: 'text',
              label: 'Site Name',
              required: true,
              defaultValue: 'Canopy Embedded',
              admin: {
                placeholder: 'Your company or website name',
              },
            },
            {
              name: 'siteUrl',
              type: 'text',
              label: 'Site URL',
              required: true,
              defaultValue: 'https://www.canopyembedded.com',
              admin: {
                placeholder: 'https://example.com (no trailing slash)',
              },
            },
            {
              name: 'siteTagline',
              type: 'text',
              label: 'Site Tagline',
              admin: {
                placeholder: 'Short description of your site',
              },
            },
            {
              name: 'titleSeparator',
              type: 'text',
              label: 'Title Separator',
              defaultValue: '|',
              admin: {
                placeholder: 'Character used between page title and site name (e.g., | or —)',
              },
            },
            {
              name: 'defaultSeoTitle',
              type: 'text',
              label: 'Default SEO Title',
              admin: {
                placeholder: 'Used as fallback if page SEO title is not set',
              },
            },
            {
              name: 'defaultMetaDescription',
              type: 'text',
              label: 'Default Meta Description',
              admin: {
                placeholder: 'Used as fallback if page meta description is not set (150-160 chars)',
              },
            },
            {
              name: 'defaultKeywords',
              type: 'array',
              label: 'Default Keywords',
              fields: [
                {
                  name: 'keyword',
                  type: 'text',
                  required: true,
                },
              ],
              admin: {
                description: 'Keywords to use across the site when page-specific ones are not provided',
              },
            },
          ],
        },
        {
          label: 'Organization',
          fields: [
            {
              name: 'organization',
              type: 'group',
              fields: [
                {
                  name: 'organizationName',
                  type: 'text',
                  label: 'Organization Name',
                  admin: {
                    placeholder: 'Legal business name',
                  },
                },
                {
                  name: 'legalName',
                  type: 'text',
                  label: 'Legal Name (if different)',
                },
                {
                  name: 'organizationType',
                  type: 'select',
                  label: 'Organization Type',
                  defaultValue: 'Organization',
                  options: [
                    { label: 'Organization', value: 'Organization' },
                    { label: 'LocalBusiness', value: 'LocalBusiness' },
                    { label: 'Corporation', value: 'Corporation' },
                  ],
                },
                {
                  name: 'logo',
                  type: 'upload',
                  relationTo: 'media',
                  label: 'Organization Logo',
                },
                {
                  name: 'telephone',
                  type: 'text',
                  label: 'Telephone',
                },
                {
                  name: 'email',
                  type: 'text',
                  label: 'Email',
                },
                {
                  name: 'address',
                  type: 'group',
                  label: 'Address',
                  fields: [
                    {
                      name: 'streetAddress',
                      type: 'text',
                      label: 'Street Address',
                    },
                    {
                      name: 'addressLocality',
                      type: 'text',
                      label: 'City',
                    },
                    {
                      name: 'addressRegion',
                      type: 'text',
                      label: 'State/Province',
                    },
                    {
                      name: 'postalCode',
                      type: 'text',
                      label: 'Postal Code',
                    },
                    {
                      name: 'addressCountry',
                      type: 'text',
                      label: 'Country',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Social Profiles',
          fields: [
            {
              name: 'socialProfiles',
              type: 'group',
              fields: [
                {
                  name: 'linkedin',
                  type: 'text',
                  label: 'LinkedIn URL',
                  admin: {
                    placeholder: 'https://linkedin.com/company/...',
                  },
                },
                {
                  name: 'facebook',
                  type: 'text',
                  label: 'Facebook URL',
                },
                {
                  name: 'twitter',
                  type: 'text',
                  label: 'Twitter/X URL',
                },
                {
                  name: 'youtube',
                  type: 'text',
                  label: 'YouTube URL',
                },
                {
                  name: 'instagram',
                  type: 'text',
                  label: 'Instagram URL',
                },
              ],
            },
          ],
        },
        {
          label: 'Open Graph & Twitter',
          fields: [
            {
              name: 'openGraphDefaults',
              type: 'group',
              label: 'Open Graph Defaults',
              fields: [
                {
                  name: 'ogType',
                  type: 'select',
                  label: 'Default OG Type',
                  defaultValue: 'website',
                  options: [
                    { label: 'Website', value: 'website' },
                    { label: 'Article', value: 'article' },
                    { label: 'Business', value: 'business.business' },
                  ],
                },
                {
                  name: 'ogImage',
                  type: 'upload',
                  relationTo: 'media',
                  label: 'Default OG Image (1200x630px)',
                },
                {
                  name: 'ogImageAlt',
                  type: 'text',
                  label: 'OG Image Alt Text',
                },
              ],
            },
            {
              name: 'twitterDefaults',
              type: 'group',
              label: 'Twitter Defaults',
              fields: [
                {
                  name: 'cardType',
                  type: 'select',
                  label: 'Default Card Type',
                  defaultValue: 'summary_large_image',
                  options: [
                    { label: 'Summary', value: 'summary' },
                    { label: 'Summary Large Image', value: 'summary_large_image' },
                  ],
                },
                {
                  name: 'siteHandle',
                  type: 'text',
                  label: 'Site Twitter Handle',
                  admin: {
                    placeholder: '@yourhandle',
                  },
                },
                {
                  name: 'creatorHandle',
                  type: 'text',
                  label: 'Creator Twitter Handle',
                  admin: {
                    placeholder: '@authorhandle',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'Robots & Sitemap',
          fields: [
            {
              name: 'allowIndexing',
              type: 'checkbox',
              label: 'Allow Search Engine Indexing',
              defaultValue: true,
              admin: {
                description: 'Uncheck to globally noindex the site (e.g., for non-prod environments)',
              },
            },
            {
              name: 'sitemapUrl',
              type: 'text',
              label: 'Sitemap URL',
              defaultValue: 'https://www.canopyembedded.com/sitemap.xml',
              admin: {
                description: 'Full URL to the sitemap.xml (used in robots.txt)',
              },
            },
            {
              name: 'disallowPaths',
              type: 'array',
              label: 'Disallowed Paths (robots.txt)',
              fields: [
                {
                  name: 'path',
                  type: 'text',
                  required: true,
                  admin: {
                    placeholder: '/admin, /api/*, etc.',
                  },
                },
              ],
              admin: {
                description: 'Paths blocked from all search engines',
              },
            },
          ],
        },
      ],
    },
  ],
}

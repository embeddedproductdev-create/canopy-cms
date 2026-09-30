import type { GlobalConfig } from 'payload'

export const SiteChrome: GlobalConfig = {
  slug: 'site-chrome',
  label: 'Site Chrome & UI Text',
  admin: {
    group: 'Globals',
    description: 'Global UI strings and chrome text used across the site',
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
          label: 'Primary CTA',
          fields: [
            {
              name: 'primaryCta',
              type: 'group',
              label: 'Primary CTA (Fallback)',
              admin: {
                description: 'Default site-wide CTA button — pages can override',
              },
              fields: [
                {
                  name: 'label',
                  type: 'text',
                  label: 'Button Label',
                  required: true,
                  defaultValue: 'Talk to an Engineer',
                },
                {
                  name: 'url',
                  type: 'text',
                  label: 'URL',
                  required: true,
                  defaultValue: '/engagement-model/',
                },
              ],
            },
          ],
        },
        {
          label: 'Back Links',
          fields: [
            {
              name: 'backLinks',
              type: 'group',
              fields: [
                {
                  name: 'portfolio',
                  type: 'text',
                  label: 'Back to Portfolio Label',
                  defaultValue: '← Back to Portfolio',
                },
                {
                  name: 'insights',
                  type: 'text',
                  label: 'Back to Insights Label',
                  defaultValue: '← Back to Insights',
                },
                {
                  name: 'capabilities',
                  type: 'text',
                  label: 'Back to Capabilities Label',
                  defaultValue: '← Back to Capabilities',
                },
              ],
            },
          ],
        },
        {
          label: 'Empty States',
          fields: [
            {
              name: 'emptyStates',
              type: 'group',
              fields: [
                {
                  name: 'noProjects',
                  type: 'text',
                  label: 'No Projects Message',
                  defaultValue: 'No projects available yet.',
                },
                {
                  name: 'noInsights',
                  type: 'text',
                  label: 'No Insights Message',
                  defaultValue: 'No insights available yet.',
                },
              ],
            },
          ],
        },
        {
          label: 'List Labels',
          fields: [
            {
              name: 'listLabels',
              type: 'group',
              fields: [
                {
                  name: 'viewProjectCta',
                  type: 'text',
                  label: 'View Project CTA',
                  defaultValue: 'View Project →',
                },
                {
                  name: 'readArticleCta',
                  type: 'text',
                  label: 'Read Article CTA',
                  defaultValue: 'Read Article →',
                },
                {
                  name: 'viewDetailsCta',
                  type: 'text',
                  label: 'View Details CTA',
                  defaultValue: 'View Details →',
                },
              ],
            },
          ],
        },
        {
          label: 'Checklist UI',
          fields: [
            {
              name: 'checklistUi',
              type: 'group',
              fields: [
                {
                  name: 'itemsHeading',
                  type: 'text',
                  label: 'Items Heading',
                  defaultValue: 'Checklist Items',
                },
                {
                  name: 'lockedItemsSuffixTemplate',
                  type: 'text',
                  label: 'Locked Items Suffix (use {count} for placeholder)',
                  defaultValue: '+ {count} more items locked (submit form to unlock)',
                },
                {
                  name: 'downloadPrompt',
                  type: 'text',
                  label: 'Download Prompt',
                  defaultValue: 'Download the full checklist with all items:',
                },
                {
                  name: 'getFullChecklistCta',
                  type: 'text',
                  label: 'Get Full Checklist Button',
                  defaultValue: 'Get Full Checklist',
                },
              ],
            },
          ],
        },
        {
          label: 'Checklist Modal',
          fields: [
            {
              name: 'checklistModal',
              type: 'group',
              fields: [
                {
                  name: 'title',
                  type: 'text',
                  label: 'Modal Title',
                  defaultValue: 'What do you need help with?',
                },
                {
                  name: 'subtitle',
                  type: 'text',
                  label: 'Modal Subtitle',
                  defaultValue: 'Choose the area to continue with the appropriate checklist',
                },
                {
                  name: 'continueCta',
                  type: 'text',
                  label: 'Continue Button Label',
                  defaultValue: 'Continue',
                },
                {
                  name: 'fallbackCategories',
                  type: 'array',
                  label: 'Fallback Categories',
                  admin: {
                    description: 'Shown if CMS categories fail to load',
                  },
                  fields: [
                    { name: 'label', type: 'text', label: 'Label', required: true },
                    { name: 'description', type: 'text', label: 'Description' },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: '404 Page',
          fields: [
            {
              name: 'notFound',
              type: 'group',
              fields: [
                {
                  name: 'heading',
                  type: 'text',
                  label: 'Heading',
                  defaultValue: 'Page Not Found',
                },
                {
                  name: 'body',
                  type: 'text',
                  label: 'Body Text',
                  defaultValue: 'The page you are looking for does not exist.',
                },
                {
                  name: 'ctaLabel',
                  type: 'text',
                  label: 'CTA Label',
                  defaultValue: 'Return to Home',
                },
                {
                  name: 'ctaUrl',
                  type: 'text',
                  label: 'CTA URL',
                  defaultValue: '/',
                },
              ],
            },
          ],
        },
        {
          label: 'Navigation',
          fields: [
            {
              name: 'navFallback',
              type: 'group',
              fields: [
                {
                  name: 'logoText',
                  type: 'text',
                  label: 'Logo Fallback Text',
                  defaultValue: 'Canopy',
                  admin: {
                    description: 'Shown if logo image fails to load',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

import type { CollectionConfig } from 'payload'
import { detailAccess, detailHooks, faqsField, heroFields, seoGroupField, stacksField } from '../fields/serviceDetail'

export const Capability: CollectionConfig = {
  slug: 'capability',
  labels: { singular: 'Capability', plural: 'Capabilities' },
  admin: {
    useAsTitle: 'title',
    group: 'Content Management',
    defaultColumns: ['title', 'slug', 'updatedAt'],
  },
  access: detailAccess,
  hooks: detailHooks,
  fields: [
    ...heroFields,
    { name: 'includedHeading', type: 'text', label: 'What is included: heading' },
    {
      name: 'included',
      type: 'array',
      label: 'What is included',
      fields: [
        { name: 'title', type: 'text', required: true },
        {
          name: 'icon',
          type: 'text',
          admin: { description: 'Optional icon name (chip, pulse, code, cube, monitor, cloud, bolt, layers, wave, cpu).' },
        },
        { name: 'text', type: 'textarea' },
        { name: 'tags', type: 'text', admin: { description: 'Comma separated chips.' } },
      ],
    },
    { name: 'whyHeading', type: 'text', label: 'Intro band heading (optional)' },
    { name: 'whyText', type: 'textarea', label: 'Intro band text (optional)' },
    stacksField,
    { name: 'workflowEyebrow', type: 'text' },
    { name: 'workflowHeading', type: 'text' },
    { name: 'workflowIntro', type: 'textarea' },
    {
      name: 'workflow',
      type: 'textarea',
      label: 'Workflow steps',
      admin: { description: 'One step per line:  Title | short text' },
    },
    { name: 'projectsHeading', type: 'text' },
    { name: 'relatedProjects', type: 'relationship', relationTo: 'case-study', hasMany: true, label: 'Related projects' },
    { name: 'insightsHeading', type: 'text' },
    { name: 'relatedInsights', type: 'relationship', relationTo: 'blog', hasMany: true, label: 'Related insights' },
    { name: 'faqHeading', type: 'text' },
    faqsField,
    seoGroupField,
  ],
}

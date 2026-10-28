import type { CollectionConfig, Field } from 'payload'
import { pick, section } from '../fields/sections'
import { contentTransferEndpoints } from '../utilities/contentTransfer'
import {
  detailAccess,
  detailHooks,
  faqsField,
  identityFields,
  layoutSectionsField,
  seoGroupField,
  serviceContentFields,
  stacksField,
} from '../fields/serviceDetail'

export const Capability: CollectionConfig = {
  slug: 'capability',
  labels: { singular: 'Capability', plural: 'Capabilities' },
  admin: {
    components: { beforeList: ['/components/admin/ContentTransferButtons'] },
    useAsTitle: 'title',
    group: 'Content Management',
    defaultColumns: ['title', 'slug', 'updatedAt'],
  },
  access: detailAccess,
  hooks: detailHooks,
  endpoints: contentTransferEndpoints('capability'),
  fields: [
    ...pick(identityFields, 'title', 'slug'),
    section('hero', 'Hero', [
      ...pick(identityFields, 'heading', 'subheading', 'summary'),
      ...serviceContentFields.map((field): Field =>
        'name' in field && field.name === 'heroImageFit'
          ? { ...field, name: 'imageFit' }
          : 'name' in field && field.name === 'heroImageAlign'
            ? { ...field, name: 'imageAlign' }
            : field,
      ),
    ]),
    section('scope', 'What is included', [
      { name: 'includedHeading', type: 'text', label: 'Included section heading' },
      {
        name: 'included',
        type: 'array',
        label: 'Included capabilities',
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'icon', type: 'text', admin: { description: 'Optional icon name.' } },
          { name: 'text', type: 'textarea' },
          { name: 'tags', type: 'text', admin: { description: 'Comma-separated chips.' } },
        ],
      },
      { name: 'whyHeading', type: 'text', label: 'Intro band heading' },
      { name: 'whyText', type: 'textarea', label: 'Intro band text' },
    ]),
    section('technology', 'Technology', [stacksField]),
    section('process', 'Workflow', [
      { name: 'workflowEyebrow', type: 'text' },
      { name: 'workflowHeading', type: 'text' },
      { name: 'workflowIntro', type: 'textarea' },
      { name: 'workflow', type: 'textarea', admin: { description: 'One step per line: Title | short text.' } },
    ]),
    section('related', 'Related work', [
      { name: 'projectsHeading', type: 'text' },
      { name: 'relatedProjects', type: 'relationship', relationTo: 'case-study', hasMany: true, label: 'Related projects' },
      { name: 'insightsHeading', type: 'text' },
      { name: 'relatedInsights', type: 'relationship', relationTo: 'blog', hasMany: true, label: 'Related insights' },
    ]),
    section('faq', 'FAQ', [{ name: 'faqHeading', type: 'text' }, faqsField]),
    layoutSectionsField,
    seoGroupField,
  ],
}

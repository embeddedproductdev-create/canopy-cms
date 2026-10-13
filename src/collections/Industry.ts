import type { CollectionConfig } from 'payload'
import { detailAccess, detailHooks, identityFields, layoutSectionsField, seoGroupField } from '../fields/serviceDetail'

export const Industry: CollectionConfig = {
  slug: 'industry',
  labels: { singular: 'Industry', plural: 'Industries' },
  admin: {
    useAsTitle: 'title',
    group: 'Content Management',
    defaultColumns: ['title', 'slug', 'updatedAt'],
  },
  access: detailAccess,
  hooks: detailHooks,
  fields: [...identityFields, layoutSectionsField, seoGroupField],
}

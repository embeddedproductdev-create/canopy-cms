import type { CollectionConfig } from 'payload'
import { detailAccess, detailHooks, identityFields, layoutSectionsField, seoGroupField } from '../fields/serviceDetail'

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
  fields: [...identityFields, layoutSectionsField, seoGroupField],
}

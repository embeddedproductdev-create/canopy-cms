import type { CollectionConfig } from 'payload'
import { isAdmin, isEditorOrAdmin, isPublic } from '../access'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Media', plural: 'Media' },
  admin: {
    group: 'Collections',
  },
  access: {
    create: isEditorOrAdmin,
    read: isPublic,
    update: isEditorOrAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: {
    crop: false,
    focalPoint: false,
    // Allow-list: images, short video and PDF only (no SVG/HTML, which can carry script).
    mimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'video/mp4', 'video/webm', 'application/pdf'],
  },
}

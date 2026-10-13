import { describe, expect, it } from 'vitest'
import config from '@/payload.config'
import { sectionLayouts, sectionTypes } from '../../src/collections/sectionLayouts'

type AnyField = { name?: string; type: string; relationTo?: unknown; hasMany?: boolean; fields?: AnyField[]; tabs?: { fields: AnyField[] }[] }

const identity: Record<string, string[]> = {
  page: ['title', 'heading', 'subheading', 'eyebrow', 'pageType', 'url', 'heroImage', 'body', 'cta', 'pills', 'layoutSections', 'seo'],
  capability: ['title', 'slug', 'heading', 'subheading', 'summary', 'layoutSections', 'seo'],
  industry: ['title', 'slug', 'heading', 'subheading', 'summary', 'layoutSections', 'seo'],
  'case-study': ['title', 'slug', 'heading', 'subheading', 'category', 'featured', 'body', 'tags', 'Images', 'cardCta', 'pageCta', 'projectStage', 'layoutSections', 'seo'],
  blog: ['title', 'slug', 'heading', 'category', 'featured', 'dek', 'image', 'byline', 'publishedDate', 'updatedDate', 'body', 'tags', 'layoutSections', 'seo'],
  checklist: ['title', 'heading', 'subheading', 'introduction', 'slug', 'itemsHeading', 'items', 'visibleItems', 'lockedItemsCount', 'pdfAsset', 'layoutSections', 'seo'],
  section: ['title', 'type', 'variant', 'eyebrow', 'heading', 'subheading', 'body', 'tags', 'cta', 'secondaryCta', 'image', 'cards', 'sectionKey', 'anchor', 'hidden'],
  card: ['title', 'type', 'subheading', 'value', 'shortDescription', 'description', 'ctaLabel', 'ctaUrl', 'icon', 'tags', 'image'],
}

function names(fields: AnyField[]): AnyField[] {
  return fields.flatMap((field) => {
    if (field.type === 'row' || field.type === 'collapsible') return names(field.fields ?? [])
    if (field.type === 'tabs') return (field.tabs ?? []).flatMap((tab) => names(tab.fields))
    return field.name ? [field] : []
  })
}

describe('Page + Section + Card pattern', () => {
  it('keeps every content collection to identity fields plus layout sections', async () => {
    const resolved = await config
    for (const [slug, allowed] of Object.entries(identity)) {
      const collection = resolved.collections.find((c) => c.slug === slug)
      expect(collection, slug).toBeDefined()
      const present = names(collection!.fields as unknown as AnyField[]).map((f) => f.name!)
      const extra = present.filter((name) => !allowed.includes(name) && !['id', 'createdAt', 'updatedAt', '_status'].includes(name))
      expect(extra, `${slug} has fields outside the pattern`).toEqual([])
    }
  })

  it('gives Pages, Capabilities, Industries, Portfolio, Insights and Checklists their body as layoutSections', async () => {
    const resolved = await config
    for (const slug of ['page', 'capability', 'industry', 'case-study', 'blog', 'checklist']) {
      const collection = resolved.collections.find((c) => c.slug === slug)!
      const field = names(collection.fields as unknown as AnyField[]).find((f) => f.name === 'layoutSections')
      expect(field, slug).toBeDefined()
      expect(field!.type).toBe('relationship')
      expect(field!.relationTo).toBe('section')
      expect(field!.hasMany).toBe(true)
    }
  })

  it('describes every section type that the select offers', async () => {
    const resolved = await config
    const section = resolved.collections.find((c) => c.slug === 'section')!
    const type = names(section.fields as unknown as AnyField[]).find((f) => f.name === 'type') as AnyField & { options?: { value: string }[] }
    expect(type.options?.map((option) => option.value).sort()).toEqual([...sectionTypes].sort())
    for (const layout of Object.values(sectionLayouts)) expect(layout.renders.length).toBeGreaterThan(0)
  })
})

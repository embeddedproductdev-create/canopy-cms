import type { Field, JSONField } from 'payload'
import { normalizeUrlValue } from '../hooks/normalizeUrl'

type Json = unknown

const isRecord = (value: Json): value is Record<string, Json> => typeof value === 'object' && value !== null && !Array.isArray(value)

// Bare emails, phones and www. links typed into the JSON get the same treatment as every other URL field.
function normalizeLinks(value: Json): Json {
  if (Array.isArray(value)) return value.map(normalizeLinks)
  if (!isRecord(value)) return value
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, key === 'url' || key === 'href' ? normalizeUrlValue(entry) : normalizeLinks(entry)]))
}

const text = { type: 'string' }

function jsonField(name: string, label: string, schema: Record<string, unknown>, check: (value: Json) => string | true, links = false): JSONField {
  return {
    name,
    type: 'json',
    label,
    jsonSchema: { uri: `canopy://schema/${name}.json`, fileMatch: [`canopy://schema/${name}.json`], schema },
    validate: (value: Json) => (value === undefined || value === null ? true : check(value)),
    hooks: links ? { beforeValidate: [({ value }) => normalizeLinks(value)] } : undefined,
  }
}

const listOf = (value: Json, what: string, item: (entry: Record<string, Json>, where: string) => string | true): string | true => {
  if (!Array.isArray(value)) return `${what} must be a list: [ { ... }, { ... } ]`
  for (const [index, entry] of value.entries()) {
    if (!isRecord(entry)) return `${what} item ${index + 1} must be an object`
    const problem = item(entry, `${what} item ${index + 1}`)
    if (problem !== true) return problem
  }
  return true
}

const needs = (entry: Record<string, Json>, keys: string[], where: string): string | true => {
  for (const key of keys) if (typeof entry[key] !== 'string' || !entry[key]) return `${where} needs a text "${key}"`
  return true
}

const linkList = (value: Json, what: string): string | true => listOf(value, what, (entry, where) => needs(entry, ['label', 'href'], where))

export const navItemsField: Field = jsonField(
  'navItems',
  'Main Navigation Menu (JSON)',
  {
    type: 'array',
    items: {
      type: 'object',
      required: ['label', 'url'],
      properties: {
        label: text,
        url: text,
        children: { type: 'array', items: { type: 'object', required: ['label', 'url'], properties: { label: text, url: text, description: text } } },
      },
    },
  },
  (value) =>
    listOf(value, 'Main Navigation Menu', (entry, where) => {
      const base = needs(entry, ['label', 'url'], where)
      if (base !== true) return base
      return entry.children === undefined ? true : listOf(entry.children, `${where} children`, (child, childWhere) => needs(child, ['label', 'url'], childWhere))
    }),
  true,
)

export const linkGroupsField: Field = jsonField(
  'linkGroups',
  'Link Groups (JSON)',
  {
    type: 'array',
    items: {
      type: 'object',
      required: ['heading', 'links'],
      properties: { heading: text, links: { type: 'array', items: { type: 'object', required: ['label', 'href'], properties: { label: text, href: text } } } },
    },
  },
  (value) =>
    listOf(value, 'Link Groups', (entry, where) => {
      const base = needs(entry, ['heading'], where)
      return base !== true ? base : linkList(entry.links, `${where} links`)
    }),
  true,
)

export const socialLinksField: Field = jsonField(
  'socialLinks',
  'Social Links (JSON)',
  {
    type: 'array',
    items: { type: 'object', required: ['label', 'href', 'icon'], properties: { label: text, href: text, icon: { enum: ['linkedin', 'instagram', 'twitter'] } } },
  },
  (value) =>
    listOf(value, 'Social Links', (entry, where) => {
      const base = needs(entry, ['label', 'href'], where)
      if (base !== true) return base
      return ['linkedin', 'instagram', 'twitter'].includes(String(entry.icon)) ? true : `${where} needs "icon": "linkedin", "instagram" or "twitter"`
    }),
  true,
)

export const disallowPathsField: Field = jsonField(
  'disallowPaths',
  'Disallowed Paths (JSON)',
  { type: 'array', items: { type: 'string' } },
  (value) => (Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.startsWith('/')) ? true : 'Disallowed Paths must be a list of paths that start with /, for example ["/admin", "/api/*"]'),
)

export const uiLabelsField: Field = jsonField(
  'uiLabels',
  'UI Label Registry (JSON)',
  { type: 'object', additionalProperties: text },
  (value) => (isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string') ? true : 'UI Labels must be an object of text values: { "key": "text" }'),
)

import type { TextFieldSingleValidation } from 'payload'

export type SectionField = 'eyebrow' | 'heading' | 'subheading' | 'body' | 'items' | 'cta' | 'secondaryCta' | 'image' | 'cards'

export interface SectionLayout {
  label: string
  renders: string
  fields: SectionField[]
  variants: Record<string, string>
  items?: string
  cards?: string
}

const COLUMNS = { col: 'Place this section next to the neighbouring section marked col (two columns)' }

export const sectionLayouts: Record<string, SectionLayout> = {
  hero: {
    label: 'Hero',
    renders: 'Page header with title, intro, buttons, stats and breadcrumbs',
    fields: ['eyebrow', 'heading', 'subheading', 'cta', 'secondaryCta', 'image', 'cards'],
    variants: { sage: 'Green header with a picture on the right', left: 'Left aligned', center: 'Centred header' },
    cards: 'Kind Stat: title + value. Kind Breadcrumb: title + link URL',
  },
  tabs: {
    label: 'Tabs',
    renders: 'Discipline tabs with a picture, headline, text and chips per tab',
    fields: ['heading', 'image', 'cards'],
    variants: {},
    cards: 'Title = tab name, Subtitle = headline, Short description, Tags (first 3 shown as chips), Link, Image',
  },
  steps: {
    label: 'Steps',
    renders: 'Numbered process',
    fields: ['eyebrow', 'heading', 'subheading', 'cta', 'cards'],
    variants: {
      hover: 'Cards expand on hover and show the description bullets',
      vertical: 'Vertical timeline; the last step is highlighted',
      nodes: 'Horizontal stepper',
      ...COLUMNS,
    },
    cards: 'Title, Subtitle, Short description, Description (bullet list shown on hover), Image',
  },
  form: {
    label: 'Form',
    renders: 'Enquiry form that posts to Form Submissions',
    fields: ['heading', 'subheading', 'body', 'cta', 'cards'],
    variants: { ...COLUMNS },
    cards:
      'Kind Field: title = label, Value = input type (text, email, textarea, select), Short description = placeholder, Subtitle = hint, Tags = select options',
  },
  stats: {
    label: 'Stats',
    renders: 'Row of big numbers',
    fields: ['eyebrow', 'heading', 'subheading', 'cta', 'cards'],
    variants: { ...COLUMNS },
    cards: 'Kind Stat: title = label, Value = number (animated when numeric)',
  },
  cards: {
    label: 'Cards',
    renders: 'Grid of cards',
    fields: ['eyebrow', 'heading', 'subheading', 'body', 'cta', 'image', 'cards'],
    variants: {
      grid2: 'Two columns',
      grid3: 'Three columns',
      grid4: 'Four columns',
      numbered: 'Show 01, 02 ... computed from the order',
      summary: 'Plain text columns for a short summary, the last one highlighted',
      icons: 'Show an icon on every card',
      media: 'Picture cards with a link',
      pills: 'Only titles as pill links',
      links: 'Whole card is a link',
      olive: 'Olive background',
      dark: 'Dark background with the section image',
      surface: 'Grey background',
      ...COLUMNS,
    },
    cards: 'Title (summary variant: label), Subtitle (media cards), Short description, Icon, Link, Tags, Image (media cards). Body = small note under the cards',
  },
  chips: {
    label: 'Chips',
    renders: 'Row of outlined keyword chips',
    fields: ['eyebrow', 'heading', 'subheading', 'items'],
    variants: { surface: 'Grey background', ...COLUMNS },
    items: 'One chip per item',
  },
  marquee: {
    label: 'Marquee',
    renders: 'Scrolling strip of names or logos',
    fields: ['eyebrow', 'heading', 'subheading', 'items'],
    variants: { ...COLUMNS },
    items: 'Name|MARK|/api/media/file/logo.png per item ',
  },
  table: {
    label: 'Table',
    renders: 'Rows and columns made of cards',
    fields: ['eyebrow', 'heading', 'subheading', 'body', 'items', 'cards'],
    variants: {
      list: 'Plain list with chips',
      facts: 'Label and value pairs',
      matrix: 'Numbered rows with a tick',
      spec: 'Specification table with the heading numbered; a card with icon check shows a Built in badge',
      ...COLUMNS,
    },
    items: 'Column headings',
    cards: 'One row per card: Title = first column, Value / Tags / Link = second column, Icon check = tick',
  },
  faq: {
    label: 'FAQ',
    renders: 'Accordion of questions',
    fields: ['eyebrow', 'heading', 'subheading', 'cards'],
    variants: { ...COLUMNS },
    cards: 'Title = question, Short description = answer',
  },
  text: {
    label: 'Text',
    renders: 'Heading on the left, text on the right',
    fields: ['eyebrow', 'heading', 'subheading', 'body', 'cta', 'items'],
    variants: { lead: 'Larger body text', surface: 'Grey band', ...COLUMNS },
    items: 'Numbered tiles below the text',
  },
  list: {
    label: 'List',
    renders: 'Bullet list',
    fields: ['eyebrow', 'heading', 'subheading', 'cards'],
    variants: { ...COLUMNS },
    cards: 'Title = bullet text',
  },
  team: {
    label: 'Team',
    renders: 'People grid',
    fields: ['eyebrow', 'heading', 'subheading', 'cards'],
    variants: { ...COLUMNS },
    cards: 'Title = name, Subtitle = role, Short description = bio, Image = photo, numbered from the order',
  },
  projects: {
    label: 'Projects',
    renders: 'Portfolio cards pulled from Portfolio',
    fields: ['heading', 'subheading', 'cta', 'secondaryCta', 'items', 'cards'],
    variants: {
      recent: 'Badge on the first project',
      related: 'Related projects block',
      ...COLUMNS,
    },
    items: 'Portfolio slugs to show, in order',
    cards: 'Overrides (title = slug) and Kind Empty slots',
  },
  articles: {
    label: 'Articles',
    renders: 'Insight cards pulled from Insights',
    fields: ['eyebrow', 'heading', 'subheading', 'items'],
    variants: { related: 'Related articles block', ...COLUMNS },
    items: 'Insight slugs to show, in order',
  },
  featured: {
    label: 'Featured article',
    renders: 'The featured Insights post (filled by the Insights page)',
    fields: ['heading'],
    variants: {},
  },
  subscribe: {
    label: 'Subscribe',
    renders: 'Email sign-up box',
    fields: ['heading', 'subheading', 'cta'],
    variants: { ...COLUMNS },
  },
  'cta-band': {
    label: 'Call-to-action band',
    renders: 'Closing band; the last band of a page becomes the contact band',
    fields: ['heading', 'subheading', 'cta', 'secondaryCta', 'cards'],
    variants: { inline: 'Lighter band that is not used as the contact band', ...COLUMNS },
    cards: 'Kind Link: title = link text, Link URL',
  },
}

export const sectionTypes = Object.keys(sectionLayouts)

export const sectionTypeOptions = sectionTypes.map((value) => ({ value, label: sectionLayouts[value].label }))

export const cardKindOptions = [
  { value: 'stat', label: 'Stat' },
  { value: 'breadcrumb', label: 'Breadcrumb' },
  { value: 'field', label: 'Form field' },
  { value: 'link', label: 'Link' },
  { value: 'empty', label: 'Empty slot' },
]

export function layoutFor(type: unknown): SectionLayout | undefined {
  return typeof type === 'string' ? sectionLayouts[type] : undefined
}

export function showsField(field: SectionField) {
  return (data: Record<string, unknown> | undefined): boolean => {
    const layout = layoutFor(data?.type)
    return !!layout && layout.fields.includes(field)
  }
}

export const validateVariant: TextFieldSingleValidation = (value, { siblingData }) => {
  const tokens = typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : []
  if (!tokens.length) return true
  const layout = layoutFor((siblingData as Record<string, unknown> | undefined)?.type)
  if (!layout) return true
  const unknown = tokens.filter((token) => !(token in layout.variants))
  if (!unknown.length) return true
  const allowed = Object.keys(layout.variants).join(', ') || 'none'
  return `Not available for ${layout.label}: ${unknown.join(', ')}. Allowed: ${allowed}`
}

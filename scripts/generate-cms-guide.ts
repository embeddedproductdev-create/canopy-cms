import fs from 'fs'
import path from 'path'
import config from '../src/payload.config'
import { sectionLayouts, sectionTypes, type SectionField } from '../src/collections/sectionLayouts'

type AnyField = {
  name?: string
  type: string
  label?: unknown
  required?: boolean
  relationTo?: unknown
  hasMany?: boolean
  options?: unknown
  fields?: AnyField[]
  tabs?: { label?: unknown; fields: AnyField[] }[]
  admin?: { hidden?: boolean; condition?: unknown; position?: string }
}

const notes: Record<string, string> = {
  'section.title': 'Name shown in the admin lists and in page layouts. Visitors never see it. Format: Owner - Section (Home - Hero).',
  'section.type': 'Layout used on the website. Decides which of the fields below are shown.',
  'section.variant': 'Look of the layout, space separated. Only values allowed for the chosen type are accepted (see the layout matrix).',
  'section.eyebrow': 'Small label above the heading.',
  'section.heading': 'Main heading. Wrap words in **double stars** to make them bold.',
  'section.subheading': 'Short paragraph under the heading. For Subscribe it is the placeholder of the email box.',
  'section.body': 'Rich text. For Form it holds the small notes under the button.',
  'section.tags': 'Comma separated values whose meaning depends on the type: chips, marquee names, table column headings, portfolio or article slugs, numbered tiles.',
  'section.cta': 'Button label and URL.',
  'section.image': 'Picture or video used by the layout. The alt text comes from the media item.',
  'section.cards': 'Cards used by the layout, in order.',
  'section.sectionKey': 'Internal key some pages use to find this section (features, gap, closing...). Leave it as it is.',
  'section.anchor': 'Id for in-page links such as /#disciplines.',
  'section.hidden': 'Hides the section on the website without deleting it.',
  'card.title': 'Main text of the card: name, question, label or bullet.',
  'card.type': 'Only for special cards: Stat, Breadcrumb, Form field, Link, Empty slot. Leave empty for normal cards.',
  'card.subheading': 'Second line: headline, role, hint or tagline, depending on the layout.',
  'card.value': 'Big value for stats, second column for tables, input type (text, email, textarea, select) for form fields.',
  'card.shortDescription': 'One-line text. Also the answer of an FAQ and the placeholder of a form field.',
  'card.description': 'Longer rich text. Bullet lists appear as detail rows on Steps cards.',
  'card.ctaLabel': 'Link text.',
  'card.ctaUrl': 'Link address.',
  'card.icon': 'Icon name (chip, pulse, code, cube, monitor, cloud, bolt, layers, wave, cpu, check).',
  'card.tags': 'Comma separated chips, or the options of a select field.',
  'card.image': 'Picture or video. The alt text comes from the media item.',
  'page.title': 'Admin name of the page.',
  'page.url': 'Address of the page. Filled from the title when empty.',
  'page.heading': 'Page heading.',
  'page.subheading': 'Text under the page heading.',
  'page.eyebrow': 'Small label above the page heading.',
  'page.pageType': 'landing, capability or industry; add the word left for a left aligned header.',
  'page.layoutSections': 'Sections of the page, in order. The last Call-to-action band becomes the contact band.',
  'section.secondaryCta': 'Second button label and URL (hero, projects, call-to-action band).',
  'capability.layoutSections': 'Sections of the page, in order: hero, included, workflow, stacks, projects, FAQ, insights.',
  'industry.layoutSections': 'Sections of the page, in order: hero, challenges, disciplines, products, projects, FAQ.',
  'case-study.layoutSections': 'Sections of the project page: overview, at a glance, specification tables, features.',
  'blog.layoutSections': 'Extra blocks of the article. A section with key upgrade becomes the checklist box beside the article.',
  'checklist.layoutSections': 'Extra blocks shown on the checklist page.',
  'capability.summary': 'One-line description used in lists and SEO.',
  'industry.summary': 'One-line description used in lists and SEO.',
  'media.alt': 'Description of the picture. Every place that shows the file uses this text.',
}

const cell = (value: string): string => value.replace(/\|/g, '\\|').trim()

const label = (field: AnyField): string => (typeof field.label === 'string' ? field.label : (field.name ?? ''))

const HIDDEN = new Set(['id', 'createdAt', 'updatedAt', 'resetPasswordToken', 'resetPasswordExpiration', 'salt', 'hash', 'loginAttempts', 'lockUntil', 'sessions', 'password', '_verified', '_verificationToken'])

const kind = (field: AnyField): string => {
  if (field.type === 'relationship' || field.type === 'upload') {
    const target = Array.isArray(field.relationTo) ? field.relationTo.join(', ') : String(field.relationTo)
    return `${field.type === 'upload' ? 'Upload' : 'Relationship'}${field.hasMany ? ' (many)' : ''} to ${target}`
  }
  if (field.type === 'select' && Array.isArray(field.options)) {
    return `Select: ${field.options.map((option) => (typeof option === 'string' ? option : (option as { label?: string }).label)).join(', ')}`
  }
  return { richText: 'Rich text', textarea: 'Long text', text: 'Text', checkbox: 'Checkbox', number: 'Number', date: 'Date', email: 'Email', json: 'JSON', array: 'List', group: 'Group' }[field.type] ?? field.type
}

function flatten(fields: AnyField[], prefix = ''): { path: string; field: AnyField; trail: string }[] {
  const rows: { path: string; field: AnyField; trail: string }[] = []
  for (const field of fields) {
    if (field.type === 'row' || field.type === 'collapsible') rows.push(...flatten(field.fields ?? [], prefix))
    else if (field.type === 'tabs') for (const tab of field.tabs ?? []) rows.push(...flatten(tab.fields, prefix))
    else if (field.name) {
      const full = `${prefix}${field.name}`
      rows.push({ path: full, field, trail: prefix ? `${prefix.replace(/\.$/, '').split('.').join(' > ')} > ` : '' })
      if ((field.type === 'group' || field.type === 'array') && field.fields) rows.push(...flatten(field.fields, `${full}.`))
    }
  }
  return rows
}

const fieldLabels: Record<SectionField, string> = {
  eyebrow: 'Eyebrow',
  heading: 'Heading',
  subheading: 'Subheading',
  body: 'Body',
  items: 'Items',
  cta: 'Button',
  secondaryCta: 'Second button',
  image: 'Image',
  cards: 'Cards',
}

async function main(): Promise<void> {
  const resolved = await config
  const out: string[] = []
  out.push('# How to use the Canopy CMS', '', 'Generated by `npm run docs:cms` from the Payload configuration. Do not edit by hand; change `scripts/generate-cms-guide.ts` or `src/collections/sectionLayouts.ts`. See [CONTENT-MAP.md](CONTENT-MAP.md) for what every page currently contains.', '')

  out.push(
    '## 1. The idea in one minute',
    '',
    'Everything on the website is built the same way: **Page + Section + Card**.',
    '',
    '- **Page** (or a Capability, Industry, Portfolio project, Insight or Checklist) holds the identity of the document: title, address, heading, SEO.',
    '- **Section** is one block of that document (a hero, a row of cards, FAQs, a contact band...). The document lists its sections in order under **Layout Sections**.',
    '- **Card** is one item inside a section: a step, a stat, a person, an FAQ, a table row, a form field.',
    '',
    '| Admin menu | Use it for | Body built from |',
    '|---|---|---|',
    '| Pages | Home, Portfolio, Insights, About, Engagement Model | Layout Sections |',
    '| Capability | One page per service (PCB, firmware...) | Layout Sections |',
    '| Industry | One page per sector (EV, Agritech...) | Layout Sections |',
    '| Case Study = Portfolio | One project each | Layout Sections (+ rich text story) |',
    '| Blog = Insights | One article each | Layout Sections (+ rich text article) |',
    '| Checklist | Gated checklist pages | Layout Sections (+ checklist items) |',
    '| Section / Card | The shared building blocks | - |',
    '| Header, Footer, SEO Settings, Site Chrome | Site-wide settings and every UI text | - |',
    '',
    'Nothing is hard coded on the website: if a word is visible, you can change it in the CMS. Generic button and label texts live in **Site Chrome -> UI Labels**.',
    '',
    '## 2. Everyday tasks',
    '',
    '### Change text on an existing page',
    '1. Open the document (for example Pages -> Home).',
    '2. Open the section you want from **Layout Sections** (click its title).',
    '3. Edit the heading, text or cards, then **Save** (or **Publish** for documents that have a Draft/Published status).',
    '4. Reload the website. Most edits are live immediately.',
    '',
    '### Add a section to a page',
    '1. Go to Content Management -> Section -> **Create new**.',
    '2. Give it a title in the form `Owner - Section` (for example `About - Values`). Visitors never see it.',
    '3. Choose the **Type**. The form now shows only the fields that layout reads (see section 3).',
    '4. Fill the fields, add or create its **Cards**, save.',
    '5. Open the page, add the section under **Layout Sections**, drag it to the right position, save.',
    '',
    '### Add or reorder cards',
    'Open the section, use **Cards -> + (create)** or pick an existing card, drag to reorder. Numbers such as 01, 02 follow the order automatically.',
    '',
    '### Hide a section without deleting it',
    'Tick **Hidden** on the section and save. Its cards and content stay in the CMS.',
    '',
    '### Publish a Portfolio project',
    '1. Case Study -> Create new. Fill title, slug, category, stage, cover image and the card texts.',
    '2. Build the page body under Layout Sections: Overview (cards), At a glance (stats), Specification tables (type Table, variant `spec`), Features.',
    '3. Set Status to Published.',
    '',
    '### Publish an Insight',
    '1. Blog -> Create new. Fill title, slug, category, date, intro (dek), image and the rich text body.',
    '2. Optional: add a section with key `upgrade` and variant `inline` for the checklist download box beside the article.',
    '3. Publish.',
    '',
    '### Add a Capability or Industry page',
    '1. Capability (or Industry) -> Create new: title, slug, heading, subheading, summary.',
    '2. Add sections: Hero, Included, Workflow (type Steps), tech stacks (Marquee, Chips or Table), Projects, FAQ, Insights. Copy the structure of an existing page: open it, look at its sections, and create similar ones.',
    '3. Add a link to the new page in **Header** (dropdown children) or in a Cards section with variant `links`.',
    '',
    '### Create a Checklist',
    'Checklist -> Create new: title, heading, introduction, slug, then the checklist items. Items from number "visible items + 1" onward are locked: they are stored but blurred for visitors until the form is submitted. The gate texts are the UI labels `checklist.gate.*`.',
    '',
    '### Upload media',
    'Media -> Upload. Fill **Alt** once; every place that shows the file uses it. Videos (.mp4/.webm) loop silently where an image would be. Marquee logos and checklist tiles are written as `Name|MARK|/api/media/file/<file>.png` (see the layout matrix).',
    '',
    '### Header, footer, SEO and wording',
    'Header and Footer globals hold the navigation and footer links. SEO Settings holds site defaults; every document also has an **SEO** group that overrides them. Site Chrome -> UI Labels holds every other text (button names, modal copy, form messages).',
    '',
    '### Links',
    '`https://...` opens in a new tab, `/page/` stays on the site, `#id` scrolls, `#consultation` and `#checklist-modal` open the pop-ups. Emails and phone numbers are converted to `mailto:` and `tel:` automatically.',
    '',
    '### Read form submissions',
    'The bell in the top bar lists new submissions. **Delete** archives; delete permanently from the Archive tab. Archived items are purged after 60 days.',
    '',
    '## 3. Section layouts: which fields apply when',
    '',
    'Pick the Type, then fill what the form shows. A field that is not listed for the type is hidden (this is the "condition based" behaviour).',
    '',
    '| Type | What the visitor sees | Fields shown | Variants | Items | Card fields used |',
    '|---|---|---|---|---|---|',
  )
  for (const type of sectionTypes) {
    const layout = sectionLayouts[type]
    const variants = Object.entries(layout.variants).map(([key, text]) => `**${key}**: ${text}`).join('<br>') || '-'
    out.push(`| ${layout.label} (\`${type}\`) | ${cell(layout.renders)} | ${layout.fields.map((field) => fieldLabels[field]).join(', ')} | ${cell(variants)} | ${cell(layout.items ?? '-')} | ${cell(layout.cards ?? '-')} |`)
  }
  out.push(
    '',
    '### Rules that apply to every layout',
    '',
    '- **Variant** accepts several words separated by spaces, for example `olive grid3`. A word that is not allowed for the Type is rejected with the list of allowed words.',
    '- **col** on two or more neighbouring sections places them side by side as columns.',
    '- **Hidden** switches a section off; its cards and content stay in the CMS.',
    '- Numbers such as 01, 02 are computed from the order of the cards. Reorder cards to renumber.',
    '- Pictures take their description from the Media item, so fill **Alt** once when you upload.',
    '- Links: `https://...` opens in a new tab, `/page/` stays on the site, `#id` scrolls, `#consultation` and `#checklist-modal` open the pop-ups, bare emails and phone numbers become `mailto:` and `tel:` automatically.',
    '- The last Call-to-action band of a page is the contact band above the footer. Use variant `inline` for a lighter band that should not become the contact band.',
    '',
  )

  const describe = (slug: string, title: string, fields: AnyField[]): void => {
    out.push(`## ${title}`, '', '| Field | Type | What it does |', '|---|---|---|')
    for (const { path: fieldPath, field, trail } of flatten(fields)) {
      if (field.admin?.hidden) continue
      if (HIDDEN.has(fieldPath) || fieldPath.startsWith('sessions.')) continue
      const note = notes[`${slug}.${fieldPath}`] ?? ''
      const conditional = field.admin?.condition ? ' Shown only for layouts that use it.' : ''
      const name = fieldPath === '_status' ? 'Status' : label(field)
      const type = fieldPath === '_status' ? 'Select: Draft, Published' : kind(field)
      out.push(`| ${trail}${name}${field.required ? ' *' : ''} | ${type} | ${(note + conditional).trim() || '-'} |`)
    }
    out.push('', '`*` required', '')
  }

  out.push('## 4. Field reference', '', 'Every field of every collection and global. Fields hidden by the layout rules appear only when the Type uses them.', '')
  for (const collection of resolved.collections) {
    const slug = collection.slug
    const title = typeof collection.labels?.singular === 'string' ? collection.labels.singular : slug
    describe(slug, `${title} (${slug})`, collection.fields as unknown as AnyField[])
  }
  for (const global of resolved.globals) {
    const title = typeof global.label === 'string' ? global.label : global.slug
    describe(global.slug, `${title} (global)`, global.fields as unknown as AnyField[])
  }

  out.push(
    '## 5. Publishing and environments',
    '',
    '1. Edit in the admin. The website reads content when a visitor opens a page, so most edits are live immediately.',
    '2. Changes to code, fields or layouts go through GitHub: push, then run **Deploy CMS to Cloudflare** (it also applies database migrations).',
    '3. A fresh environment is filled once with **Seed CMS Database and Media**.',
    '',
    '## 6. Troubleshooting',
    '',
    '- **A list in the admin is empty, but the website works:** the draft history is missing. Run `npm run dev` once locally (it repairs it automatically); in production the deploy workflow does it.',
    '- **A field I expect is missing on a section:** the Type does not use it. Check the layout matrix in section 3.',
    '- **"Variant not allowed":** use only the words listed for that Type.',
    '- **A section does not show on the website:** it is not in the document\'s Layout Sections, or Hidden is ticked.',
    '- **Cannot log in to the local admin from 127.0.0.1:** open the site through `localhost`.',
    '',
  )

  fs.writeFileSync(path.resolve('CMS-GUIDE.md'), out.join('\n'))
  console.log(`CMS-GUIDE.md written (${out.length} lines)`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

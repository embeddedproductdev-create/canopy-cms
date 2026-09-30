import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-d1-sqlite'

type JsonRecord = Record<string, unknown>

const asRecord = (value: unknown, context: string): JsonRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected ${context} to be a JSON object`)
  }
  return value as JsonRecord
}

const text = (value: unknown): string | undefined =>
  value === null || value === undefined ? undefined : String(value)

const richText = (value: unknown): unknown => {
  if (!value) return undefined
  if (typeof value === 'object') return value
  return {
    root: {
      type: 'root',
      children: [{ type: 'paragraph', children: [{ type: 'text', text: String(value), version: 1 }] }],
      direction: null,
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

const ensureKnownKeys = (value: JsonRecord, known: string[], context: string) => {
  const unknown = Object.keys(value).filter((key) => !known.includes(key) && key !== 'id' && key !== 'raw')
  if (unknown.length) {
    throw new Error(`Cannot migrate ${context}; unsupported JSON keys: ${unknown.join(', ')}`)
  }
}

const legacyCardSources = [
  ['cards', 'cards'],
  ['serviceCard', 'service'],
  ['breakPoints', 'breakpoint'],
  ['stats', 'stat'],
  ['teamMembers', 'teamMember'],
  ['steps', 'step'],
  ['featured', 'card'],
] as const

const validSocialIcons = ['linkedin', 'instagram', 'twitter'] as const

async function legacyImageFields(
  db: unknown,
  value: unknown,
  context: string,
): Promise<{ image?: number; imageUrl?: string }> {
  if (value === undefined || value === null || value === '') return {}
  if (typeof value === 'string') return { imageUrl: value }
  const verifyMediaRelation = async (candidate: unknown): Promise<number | undefined> => {
    const mediaId =
      typeof candidate === 'number'
        ? candidate
        : typeof candidate === 'string' && /^\d+$/.test(candidate)
          ? Number(candidate)
          : undefined
    if (mediaId === undefined) return undefined
    const found = await rows(db, sql`SELECT id FROM media WHERE id = ${mediaId} LIMIT 1`)
    return found.length > 0 ? mediaId : undefined
  }

  if (typeof value === 'number') {
    const relationId = await verifyMediaRelation(value)
    if (relationId !== undefined) return { image: relationId }
    throw new Error(`Cannot migrate ${context}; media relationship ${value} does not exist`)
  }
  const image = asRecord(value, context)
  const imageUrl = text(image.url)
  const relationId = await verifyMediaRelation(image.id)
  if (relationId !== undefined) {
    return { image: relationId, ...(imageUrl ? { imageUrl } : {}) }
  }
  if (imageUrl) return { imageUrl }
  throw new Error(`Cannot migrate ${context}; expected a URL/path or a media relationship ID`)
}

async function normalizeLegacyCard(
  db: unknown,
  value: JsonRecord,
  normalizedType: string,
  context: string,
  preserveSourceType: boolean,
) {
  ensureKnownKeys(
    value,
    [
      'title', 'heading', 'subheading', 'index', 'number', 'value', 'category', 'role', 'date',
      'image', 'imageUrl', 'imageAlt', 'icon', 'theme', 'shortDescription', 'description',
      'additionalDescription', 'body', 'ctaLabel', 'ctaHref', 'ctaUrl', 'cta', 'href',
      'readMoreLabel', 'linkedinUrl', 'type', 'tags', 'label', 'name',
    ],
    context,
  )
  const title = text(value.title) || text(value.heading) || text(value.label) || text(value.name)
  if (!title?.trim()) throw new Error(`${context} has no title, heading, label, or name`)

  const cta = value.cta === undefined ? {} : asRecord(value.cta, `${context}.cta`)
  ensureKnownKeys(cta, ['label', 'href'], `${context}.cta`)
  const tags = value.tags
  if (tags !== undefined && !Array.isArray(tags) && typeof tags !== 'string') {
    throw new Error(`${context}.tags must be an array or comma-separated string`)
  }

  return {
    title,
    heading: text(value.heading) || text(value.title) || text(value.label) || text(value.name) || '',
    subheading: text(value.subheading) || '',
    index: text(value.index) || text(value.number) || '',
    value: text(value.value) || '',
    category: text(value.category) || '',
    role: text(value.role) || '',
    date: text(value.date) || '',
    ...await legacyImageFields(db, value.image ?? value.imageUrl, `${context}.image`),
    imageAlt: text(value.imageAlt) || '',
    icon: text(value.icon) || '',
    theme: text(value.theme) || '',
    shortDescription: text(value.shortDescription) || '',
    description: richText(value.description),
    additionalDescription: richText(value.additionalDescription),
    body: text(value.body) || '',
    ctaLabel: text(value.ctaLabel) || text(cta.label) || '',
    ctaUrl: text(value.ctaUrl) || text(value.ctaHref) || text(cta.href) || text(value.href) || '',
    readMoreLabel: text(value.readMoreLabel) || '',
    linkedinUrl: text(value.linkedinUrl) || '',
    type: preserveSourceType ? text(value.type) || normalizedType : normalizedType,
    tags: Array.isArray(tags)
      ? tags.map((tag) => ({ tag: typeof tag === 'object' && tag !== null ? text((tag as JsonRecord).tag) || '' : text(tag) || '' }))
      : typeof tags === 'string'
        ? tags.split(',').map((tag) => ({ tag: tag.trim() }))
        : [],
  }
}

async function rows(db: unknown, query: ReturnType<typeof sql>): Promise<JsonRecord[]> {
  const result = await (db as { all: (query: ReturnType<typeof sql>) => Promise<JsonRecord[] | { rows?: JsonRecord[] }> }).all(query)
  return Array.isArray(result) ? result : result.rows || []
}

async function addColumn(db: unknown, table: string, column: string, definition: string) {
  const existing = await rows(db, sql.raw(`PRAGMA table_info(\`${table}\`)`))
  if (!existing.some((row) => row.name === column)) {
    await (db as { run: (query: ReturnType<typeof sql>) => Promise<unknown> }).run(
      sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`),
    )
  }
}

async function hasColumn(db: unknown, table: string, column: string): Promise<boolean> {
  const existing = await rows(db, sql.raw(`PRAGMA table_info(\`${table}\`)`))
  return existing.some((row) => row.name === column)
}

async function requireColumn(db: unknown, table: string, column: string): Promise<void> {
  if (!(await hasColumn(db, table, column))) {
    throw new Error(
      `Cannot migrate legacy content: expected ${table}.${column} to exist. ` +
        'The legacy schema may have been pushed before this migration ran; restore it from backup and rerun migrations.',
    )
  }
}

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  // Read the old representation through SQL before making any schema changes.
  // Payload's runtime config describes the new schema and cannot be used to
  // read fields that have already been removed from that config.
  await requireColumn(db, 'page', 'constant')
  await requireColumn(db, 'section', 'constant')
  await requireColumn(db, 'header', 'nav_items')
  await requireColumn(db, 'footer', 'content')

  const pageRows = await rows(db, sql`SELECT id, constant FROM page WHERE constant IS NOT NULL`)
  const sectionHasContent = await hasColumn(db, 'section', 'content')
  const sectionRows = await rows(
    db,
    sql.raw(
      `SELECT id, ${sectionHasContent ? 'content' : 'NULL AS content'}, constant FROM section WHERE ${
        sectionHasContent ? 'content IS NOT NULL OR constant IS NOT NULL' : 'constant IS NOT NULL'
      }`,
    ),
  )
  const headerHasNavCtaLabel = await hasColumn(db, 'header', 'nav_cta_label')
  const headerHasNavCtaUrl = await hasColumn(db, 'header', 'nav_cta_url')
  const headerRows = await rows(
    db,
    sql.raw(
      `SELECT id, nav_items, ${headerHasNavCtaLabel ? 'nav_cta_label' : 'NULL AS nav_cta_label'}, ${
        headerHasNavCtaUrl ? 'nav_cta_url' : 'NULL AS nav_cta_url'
      } FROM header WHERE nav_items IS NOT NULL${
        headerHasNavCtaLabel || headerHasNavCtaUrl
          ? ` OR ${[
              headerHasNavCtaLabel ? 'nav_cta_label IS NOT NULL' : '',
              headerHasNavCtaUrl ? 'nav_cta_url IS NOT NULL' : '',
            ].filter(Boolean).join(' OR ')}`
          : ''
      }`,
    ),
  )
  const footerRows = await rows(db, sql`SELECT id, content FROM footer WHERE content IS NOT NULL`)

  // Add the destination columns/tables first so Payload writes below can run
  // while the legacy JSON columns are still available for reading.
  for (const [table, column, definition] of [
    ['section', 'eyebrow', 'text'], ['section', 'tag_line', 'text'], ['section', 'highlight', 'text'],
    ['section', 'type', 'text'], ['section', 'image_alt', 'text'], ['section', 'background_image', 'text'],
    ['section', 'background_video', 'text'], ['section', 'cta_label', 'text'], ['section', 'cta_href', 'text'],
    ['section', 'summary', 'text'], ['section', 'preview_alt', 'text'], ['section', 'section_key', 'text'],
    ['section', 'heading_first_line', 'text'], ['section', 'heading_second_line', 'text'], ['section', 'logo', 'text'],
    ['section', 'image_url', 'text'], ['card', 'image_url', 'text'],
    ['section', 'mockup_assistant_name', 'text'], ['section', 'mockup_scheduling_message', 'text'],
    ['section', 'mockup_sync_title', 'text'], ['section', 'mockup_telemetry_title', 'text'],
    ['section', 'secondary_cta_label', 'text'], ['section', 'secondary_cta_href', 'text'],
    ['section', 'controls_tabs_label', 'text'], ['section', 'controls_previous_label', 'text'],
    ['section', 'controls_next_label', 'text'], ['card', 'index', 'text'], ['card', 'value', 'text'],
    ['card', 'role', 'text'], ['card', 'date', 'text'], ['card', 'image_alt', 'text'], ['card', 'icon', 'text'],
    ['card', 'theme', 'text'], ['card', 'short_description', 'text'], ['card', 'body', 'text'],
    ['card', 'read_more_label', 'text'], ['card', 'linkedin_url', 'text'], ['header', 'nav_cta_href', 'text'],
    ['footer', 'heading', 'text'], ['footer', 'sub_heading', 'text'], ['footer', 'home_link_label', 'text'],
    ['footer', 'social_nav_label', 'text'], ['footer', 'helpline_number', "text DEFAULT '+1999 888-76-54'"],
    ['footer', 'tech_support_email', "text DEFAULT 'support@canopy.com'"], ['footer', 'request_intro', "text DEFAULT 'Raise a general'"],
    ['footer', 'request_label', "text DEFAULT 'IT Support Requests'"], ['footer', 'request_url', "text DEFAULT ''"],
    ['footer', 'copyright', 'text'], ['footer', 'cta_label', 'text'], ['footer', 'cta_href', 'text'],
  ] as const) await addColumn(db, table, column, definition)
  const prepare = (query: string) => (db as { run: (query: ReturnType<typeof sql>) => Promise<unknown> }).run(sql.raw(query))
  await prepare('CREATE TABLE IF NOT EXISTS section_categories (_order integer NOT NULL, _parent_id integer NOT NULL, id text PRIMARY KEY NOT NULL, category text, FOREIGN KEY (_parent_id) REFERENCES section(id) ON DELETE cascade)')
  await prepare('CREATE TABLE IF NOT EXISTS section_image_labels (_order integer NOT NULL, _parent_id integer NOT NULL, id text PRIMARY KEY NOT NULL, label text, FOREIGN KEY (_parent_id) REFERENCES section(id) ON DELETE cascade)')
  await prepare('CREATE TABLE IF NOT EXISTS section_mockup_time_slots (_order integer NOT NULL, _parent_id integer NOT NULL, id text PRIMARY KEY NOT NULL, value text, FOREIGN KEY (_parent_id) REFERENCES section(id) ON DELETE cascade)')
  await prepare('CREATE TABLE IF NOT EXISTS section_mockup_telemetry_metrics (_order integer NOT NULL, _parent_id integer NOT NULL, id text PRIMARY KEY NOT NULL, value text, FOREIGN KEY (_parent_id) REFERENCES section(id) ON DELETE cascade)')
  await prepare('CREATE TABLE IF NOT EXISTS card_tags (_order integer NOT NULL, _parent_id integer NOT NULL, id text PRIMARY KEY NOT NULL, tag text, FOREIGN KEY (_parent_id) REFERENCES card(id) ON DELETE cascade)')
  await prepare('CREATE TABLE IF NOT EXISTS header_nav_items (_order integer NOT NULL, _parent_id integer NOT NULL, id text PRIMARY KEY NOT NULL, label text, url text, FOREIGN KEY (_parent_id) REFERENCES header(id) ON DELETE cascade)')
  await prepare('CREATE TABLE IF NOT EXISTS footer_link_groups (_order integer NOT NULL, _parent_id integer NOT NULL, id text PRIMARY KEY NOT NULL, heading text, FOREIGN KEY (_parent_id) REFERENCES footer(id) ON DELETE cascade)')
  await prepare('CREATE TABLE IF NOT EXISTS footer_link_groups_links (_order integer NOT NULL, _parent_id integer NOT NULL, id text PRIMARY KEY NOT NULL, label text, href text, FOREIGN KEY (_parent_id) REFERENCES footer_link_groups(id) ON DELETE cascade)')
  await prepare('CREATE TABLE IF NOT EXISTS footer_social_links (_order integer NOT NULL, _parent_id integer NOT NULL, id text PRIMARY KEY NOT NULL, label text, href text, icon text, FOREIGN KEY (_parent_id) REFERENCES footer(id) ON DELETE cascade)')

  // Copy the source snapshots above while the legacy columns still exist.
  for (const row of pageRows) {
    const value = JSON.parse(String(row.constant))
    const data = asRecord(value, `Page ${row.id}.constant`)
    ensureKnownKeys(data, ['title', 'heading', 'subheading', 'url', 'body', 'cta', 'pills', 'faqs', 'workflowSteps', 'teamMembers', 'companyFacts', 'seo'], `Page ${row.id}.constant`)
    await payload.update({ collection: 'page', id: row.id as string, data: data as never })
  }

  for (const row of sectionRows) {
    const content = row.content === null ? {} : asRecord(JSON.parse(String(row.content)), `Section ${row.id}.content`)
    const constant = row.constant === null ? {} : asRecord(JSON.parse(String(row.constant)), `Section ${row.id}.constant`)
    const data = { ...constant, ...content }
    ensureKnownKeys(data, ['id', 'title', 'heading', 'headingFirstLine', 'headingSecondLine', 'subheading', 'summary', 'eyebrow', 'tagLine', 'highlight', 'type', 'image', 'imageUrl', 'imageAlt', 'backgroundImage', 'backgroundVideo', 'previewAlt', 'logo', 'mockup', 'imageLabels', 'body', 'cta', 'secondaryCta', 'controls', 'categories', ...legacyCardSources.map(([key]) => key)], `Section ${row.id}`)
    const cardIDs: (string | number)[] = []
    let hasCardSource = false
    for (const [key, fallbackType] of legacyCardSources) {
      if (data[key] === undefined) continue
      hasCardSource = true
      if (!Array.isArray(data[key])) throw new Error(`Section ${row.id}.${key} must be an array`)
      for (const [index, item] of (data[key] as unknown[]).entries()) {
        const context = `Section ${row.id}.${key}[${index}]`
        const card = asRecord(item, context)
        const cardData = await normalizeLegacyCard(db, card, fallbackType, context, key === 'cards')
        const existing = await payload.find({
          collection: 'card',
          where: { title: { equals: cardData.title } },
          limit: 1,
          depth: 0,
        })
        const existingCard = existing.docs[0] as (typeof cardData & { id: string | number }) | undefined
        const migrated = existingCard
          ? await payload.update({
              collection: 'card',
              id: existingCard.id,
              data: Object.fromEntries(
                Object.entries(cardData).filter(([field]) => {
                  const existingValue = (existingCard as unknown as JsonRecord)[field]
                  return existingValue === null || existingValue === undefined || existingValue === ''
                }),
              ) as never,
            })
          : await payload.create({ collection: 'card', data: cardData as never })
        cardIDs.push(migrated.id)
      }
    }
    const mockup = asRecord(data.mockup || {}, `Section ${row.id}.mockup`)
    const sectionFields = { ...data }
    delete sectionFields.id
    delete sectionFields.image
    delete sectionFields.imageUrl
    delete sectionFields.cards
    for (const [key] of legacyCardSources) delete sectionFields[key]
    const sectionData = {
      ...sectionFields,
      ...await legacyImageFields(db, data.image ?? data.imageUrl, `Section ${row.id}.image`),
      sectionKey: text(data.id),
      headingFirstLine: text(data.headingFirstLine),
      headingSecondLine: text(data.headingSecondLine),
      summary: text(data.summary),
      previewAlt: text(data.previewAlt),
      logo: text(data.logo),
      mockup: data.mockup
        ? {
            assistantName: text(mockup.assistantName),
            schedulingMessage: text(mockup.schedulingMessage),
            timeSlots: Array.isArray(mockup.timeSlots)
              ? mockup.timeSlots.map((value) => ({ value: text(value) || '' }))
              : [],
            syncTitle: text(mockup.syncTitle),
            telemetryTitle: text(mockup.telemetryTitle),
            telemetryMetrics: Array.isArray(mockup.telemetryMetrics)
              ? mockup.telemetryMetrics.map((value) => ({ value: text(value) || '' }))
              : [],
          }
        : undefined,
      imageLabels: Array.isArray(data.imageLabels)
        ? data.imageLabels.map((label) => ({
            label: text(typeof label === 'object' && label !== null ? (label as JsonRecord).label : label) || '',
          }))
        : [],
      categories: Array.isArray(data.categories)
        ? data.categories.map((category) => ({
            category: text(typeof category === 'object' && category !== null ? (category as JsonRecord).category : category) || '',
          }))
        : [],
    }
    await payload.update({
      collection: 'section',
      id: row.id as string,
      data: {
        ...sectionData,
        body: richText(data.body),
        ...(hasCardSource ? { cards: cardIDs } : {}),
      } as never,
    })
  }

  for (const row of headerRows) {
    const items = row.nav_items === null ? [] : JSON.parse(String(row.nav_items))
    if (!Array.isArray(items)) throw new Error(`Header ${row.id}.navItems must be an array`)
    await payload.updateGlobal({
      slug: 'header',
      data: {
        navItems: items.map((item) => {
          const value = asRecord(item, `Header ${row.id}.navItems[]`)
          ensureKnownKeys(value, ['label', 'url', 'href'], `Header ${row.id}.navItems[]`)
          return { label: text(value.label) || '', url: text(value.url || value.href) || '' }
        }),
        navCta: {
          label: text(row.nav_cta_label) || '',
          href: text(row.nav_cta_url) || '',
        },
      },
    })
  }

  for (const row of footerRows) {
    const data = asRecord(JSON.parse(String(row.content)), `Footer ${row.id}.content`)
    ensureKnownKeys(data, ['heading', 'subHeading', 'homeLinkLabel', 'cta', 'socialNavLabel', 'socialLinks', 'linkGroups', 'helplineNumber', 'techSupportEmail', 'requestIntro', 'requestLabel', 'requestUrl', 'copyright'], `Footer ${row.id}`)
    const cta = data.cta === undefined ? {} : asRecord(data.cta, `Footer ${row.id}.cta`)
    ensureKnownKeys(cta, ['label', 'href'], `Footer ${row.id}.cta`)
    const socialLinks = data.socialLinks === undefined ? [] : data.socialLinks
    if (!Array.isArray(socialLinks)) throw new Error(`Footer ${row.id}.socialLinks must be an array`)
    const linkGroups = data.linkGroups === undefined ? [] : data.linkGroups
    if (!Array.isArray(linkGroups)) throw new Error(`Footer ${row.id}.linkGroups must be an array`)
    await payload.updateGlobal({
      slug: 'footer',
      data: {
        heading: text(data.heading),
        subHeading: text(data.subHeading),
        homeLinkLabel: text(data.homeLinkLabel),
        cta: { label: text(cta.label), href: text(cta.href) || '' },
        socialNavLabel: text(data.socialNavLabel),
        socialLinks: socialLinks.map((item, index) => {
          const link = asRecord(item, `Footer ${row.id}.socialLinks[${index}]`)
          ensureKnownKeys(link, ['label', 'href', 'icon'], `Footer ${row.id}.socialLinks[${index}]`)
          const icon = text(link.icon)
          if (icon && !validSocialIcons.includes(icon as (typeof validSocialIcons)[number])) {
            throw new Error(`Footer ${row.id}.socialLinks[${index}].icon has unsupported value "${icon}"`)
          }
          return { label: text(link.label) || '', href: text(link.href) || '', ...(icon ? { icon } : {}) }
        }),
        linkGroups: linkGroups.map((item, index) => {
          const group = asRecord(item, `Footer ${row.id}.linkGroups[${index}]`)
          ensureKnownKeys(group, ['heading', 'links'], `Footer ${row.id}.linkGroups[${index}]`)
          const links = group.links === undefined ? [] : group.links
          if (!Array.isArray(links)) throw new Error(`Footer ${row.id}.linkGroups[${index}].links must be an array`)
          return {
            heading: text(group.heading) || '',
            links: links.map((entry, linkIndex) => {
              const link = asRecord(entry, `Footer ${row.id}.linkGroups[${index}].links[${linkIndex}]`)
              ensureKnownKeys(link, ['label', 'href'], `Footer ${row.id}.linkGroups[${index}].links[${linkIndex}]`)
              return { label: text(link.label) || '', href: text(link.href) || '' }
            }),
          }
        }),
        helplineNumber: text(data.helplineNumber),
        techSupportEmail: text(data.techSupportEmail),
        requestIntro: text(data.requestIntro),
        requestLabel: text(data.requestLabel),
        requestUrl: text(data.requestUrl) || '',
        ...(Object.prototype.hasOwnProperty.call(data, 'copyright') ? { copyright: text(data.copyright) } : {}),
      } as never,
    })
  }

  for (const [table, column, definition] of [
    ['section', 'eyebrow', 'text'],
    ['section', 'tag_line', 'text'],
    ['section', 'highlight', 'text'],
    ['section', 'type', 'text'],
    ['section', 'image_alt', 'text'],
    ['section', 'background_image', 'text'],
    ['section', 'background_video', 'text'],
    ['section', 'cta_label', 'text'],
    ['section', 'cta_href', 'text'],
    ['section', 'secondary_cta_label', 'text'],
    ['section', 'secondary_cta_href', 'text'],
    ['section', 'controls_tabs_label', 'text'],
    ['section', 'controls_previous_label', 'text'],
    ['section', 'controls_next_label', 'text'],
    ['card', 'index', 'text'],
    ['card', 'value', 'text'],
    ['card', 'role', 'text'],
    ['card', 'date', 'text'],
    ['card', 'image_alt', 'text'],
    ['card', 'icon', 'text'],
    ['card', 'theme', 'text'],
    ['card', 'short_description', 'text'],
    ['card', 'body', 'text'],
    ['card', 'read_more_label', 'text'],
    ['card', 'linkedin_url', 'text'],
  ] as const) await addColumn(db, table, column, definition)

  await addColumn(db, 'header', 'nav_cta_href', 'text')
  await addColumn(db, 'footer', 'heading', 'text')
  await addColumn(db, 'footer', 'sub_heading', 'text')
  await addColumn(db, 'footer', 'home_link_label', 'text')
  await addColumn(db, 'footer', 'social_nav_label', 'text')
  await addColumn(db, 'footer', 'helpline_number', 'text DEFAULT \'+1999 888-76-54\'')
  await addColumn(db, 'footer', 'tech_support_email', 'text DEFAULT \'support@canopy.com\'')
  await addColumn(db, 'footer', 'request_intro', 'text DEFAULT \'Raise a general\'')
  await addColumn(db, 'footer', 'request_label', 'text DEFAULT \'IT Support Requests\'')
  await addColumn(db, 'footer', 'request_url', 'text DEFAULT \'\'')
  await addColumn(db, 'footer', 'copyright', 'text')
  await addColumn(db, 'footer', 'cta_label', 'text')
  await addColumn(db, 'footer', 'cta_href', 'text')

  const run = (query: string) => (db as { run: (query: ReturnType<typeof sql>) => Promise<unknown> }).run(sql.raw(query))
  await run('CREATE TABLE IF NOT EXISTS section_categories (_order integer NOT NULL, _parent_id integer NOT NULL, id text PRIMARY KEY NOT NULL, category text, FOREIGN KEY (_parent_id) REFERENCES section(id) ON DELETE cascade)')
  await run('CREATE INDEX IF NOT EXISTS section_categories_order_idx ON section_categories (_order)')
  await run('CREATE INDEX IF NOT EXISTS section_categories_parent_id_idx ON section_categories (_parent_id)')
  await run('CREATE TABLE IF NOT EXISTS card_tags (_order integer NOT NULL, _parent_id integer NOT NULL, id text PRIMARY KEY NOT NULL, tag text, FOREIGN KEY (_parent_id) REFERENCES card(id) ON DELETE cascade)')
  await run('CREATE INDEX IF NOT EXISTS card_tags_order_idx ON card_tags (_order)')
  await run('CREATE INDEX IF NOT EXISTS card_tags_parent_id_idx ON card_tags (_parent_id)')
  await run('CREATE TABLE IF NOT EXISTS header_nav_items (_order integer NOT NULL, _parent_id integer NOT NULL, id text PRIMARY KEY NOT NULL, label text, url text, FOREIGN KEY (_parent_id) REFERENCES header(id) ON DELETE cascade)')
  await run('CREATE INDEX IF NOT EXISTS header_nav_items_order_idx ON header_nav_items (_order)')
  await run('CREATE INDEX IF NOT EXISTS header_nav_items_parent_id_idx ON header_nav_items (_parent_id)')
  await run('CREATE TABLE IF NOT EXISTS footer_link_groups (_order integer NOT NULL, _parent_id integer NOT NULL, id text PRIMARY KEY NOT NULL, heading text, FOREIGN KEY (_parent_id) REFERENCES footer(id) ON DELETE cascade)')
  await run('CREATE TABLE IF NOT EXISTS footer_link_groups_links (_order integer NOT NULL, _parent_id integer NOT NULL, id text PRIMARY KEY NOT NULL, label text, href text, FOREIGN KEY (_parent_id) REFERENCES footer_link_groups(id) ON DELETE cascade)')
  await run('CREATE TABLE IF NOT EXISTS footer_social_links (_order integer NOT NULL, _parent_id integer NOT NULL, id text PRIMARY KEY NOT NULL, label text, href text, icon text, FOREIGN KEY (_parent_id) REFERENCES footer(id) ON DELETE cascade)')

  for (const [table, column] of [['page', 'constant'], ['section', 'content'], ['section', 'constant'], ['card', 'tags'], ['header', 'nav_items'], ['footer', 'content']] as const) {
    const existing = await rows(db, sql.raw(`PRAGMA table_info(\`${table}\`)`))
    if (existing.some((row) => row.name === column)) {
      await run(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``)
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // This migration is intentionally forward-only: restoring removed JSON would
  // reintroduce the data-loss path it replaces.
  void db
  throw new Error('The typed content-model migration is irreversible; restore the database backup instead.')
}

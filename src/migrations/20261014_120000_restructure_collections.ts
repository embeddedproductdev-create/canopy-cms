import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-d1-sqlite'
import { buildVersionRepair } from '../utilities/versionRepair'

export type Row = Record<string, unknown>
export type Reader = (query: string) => Promise<Row[]>

export interface RestructurePlan {
  statements: string[]
}

const q = (value: unknown): string => `'${String(value ?? '').replace(/'/g, "''")}'`
const nul = (value: unknown): string => (value === undefined || value === null || String(value).trim() === '' ? 'NULL' : q(value))
const text = (value: unknown): string => (typeof value === 'string' ? value : '')
const lines = (value: unknown): string[] =>
  text(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

const textNode = (value: string) => ({ type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text: value, version: 1 })
const noteBody = (value: string): string =>
  JSON.stringify({
    root: {
      type: 'root',
      children: [{ type: 'paragraph', children: [textNode(value)], direction: null as string | null, format: '', indent: 0, textFormat: 0, textStyle: '', version: 1 }],
      direction: null as string | null,
      format: '',
      indent: 0,
      version: 1,
    },
  })

interface CardSpec {
  title: string
  subheading?: string
  value?: string
  shortDescription?: string
  icon?: string
  ctaLabel?: string
  ctaUrl?: string
  tags?: string
  type?: string
}

interface SectionSpec {
  key: string
  name: string
  type: string
  variant?: string
  eyebrow?: string
  heading?: string
  subheading?: string
  note?: string
  tags?: string
  anchor?: string
  cta?: { label?: string; href?: string }
  secondaryCta?: { label?: string; href?: string }
  imageId?: number | null
  cards?: CardSpec[]
}

const cardsFromLines = (value: unknown, withUrl = false): CardSpec[] =>
  lines(value).map((line) => {
    const [title, body = '', url = ''] = line.split('|').map((part) => part.trim())
    return { title, shortDescription: body, ...(withUrl && url ? { ctaUrl: url } : {}) }
  })

const rowsFromLines = (value: unknown): CardSpec[] =>
  lines(value).map((line) => {
    const at = line.indexOf(':')
    return at === -1 ? { title: line } : { title: line.slice(0, at).trim(), tags: line.slice(at + 1).trim() }
  })

export async function ensureRestructureSchema(read: Reader): Promise<string[]> {
  const statements: string[] = []
  const columns = async (table: string): Promise<string[]> => (await read(`PRAGMA table_info("${table}")`)).map((r) => String(r.name))
  const tables = new Set((await read(`SELECT "name" FROM "sqlite_master" WHERE "type" = 'table'`)).map((r) => String(r.name)))

  for (const owner of ['capability', 'industry']) {
    if (!(await columns(`${owner}_rels`)).includes('section_id')) {
      statements.push(`ALTER TABLE "${owner}_rels" ADD COLUMN "section_id" integer REFERENCES "section"("id") ON DELETE cascade`)
      statements.push(`CREATE INDEX IF NOT EXISTS "${owner}_rels_section_id_idx" ON "${owner}_rels" ("section_id")`)
    }
  }
  if (!(await columns('capability')).includes('summary')) statements.push(`ALTER TABLE "capability" ADD COLUMN "summary" text`)

  for (const [table, owner] of [
    ['checklist_rels', 'checklist'],
    ['_checklist_v_rels', '_checklist_v'],
  ]) {
    if (tables.has(table)) continue
    statements.push(
      `CREATE TABLE "${table}" ("id" integer PRIMARY KEY NOT NULL, "order" integer, "parent_id" integer NOT NULL, "path" text NOT NULL, "section_id" integer, FOREIGN KEY ("parent_id") REFERENCES "${owner}"("id") ON UPDATE no action ON DELETE cascade, FOREIGN KEY ("section_id") REFERENCES "section"("id") ON UPDATE no action ON DELETE cascade)`,
      `CREATE INDEX "${table}_order_idx" ON "${table}" ("order")`,
      `CREATE INDEX "${table}_parent_idx" ON "${table}" ("parent_id")`,
      `CREATE INDEX "${table}_path_idx" ON "${table}" ("path")`,
      `CREATE INDEX "${table}_section_id_idx" ON "${table}" ("section_id")`,
    )
  }
  return statements
}

export async function buildRestructure(read: Reader): Promise<RestructurePlan> {
  const statements: string[] = []
  const labels = new Map((await read(`SELECT "key", "value" FROM "site_chrome_ui_labels"`)).map((r) => [String(r.key), String(r.value ?? '')]))
  const label = (key: string): string => labels.get(key) ?? ''
  let nextSection = Number((await read(`SELECT coalesce(max("id"), 0) AS n FROM "section"`))[0]?.n ?? 0)
  let nextCard = Number((await read(`SELECT coalesce(max("id"), 0) AS n FROM "card"`))[0]?.n ?? 0)

  const addSection = (spec: SectionSpec): number => {
    nextSection += 1
    const id = nextSection
    statements.push(
      `INSERT INTO "section" ("id", "title", "section_key", "heading", "subheading", "eyebrow", "type", "variant", "tags", "anchor", "body", "cta_label", "cta_href", "secondary_cta_label", "secondary_cta_href", "image_id", "hidden") VALUES (${id}, ${q(spec.name)}, ${q(spec.key)}, ${nul(spec.heading)}, ${nul(spec.subheading)}, ${nul(spec.eyebrow)}, ${q(spec.type)}, ${nul(spec.variant)}, ${nul(spec.tags)}, ${nul(spec.anchor)}, ${spec.note ? q(noteBody(spec.note)) : 'NULL'}, ${nul(spec.cta?.label)}, ${nul(spec.cta?.href)}, ${nul(spec.secondaryCta?.label)}, ${nul(spec.secondaryCta?.href)}, ${spec.imageId ? Number(spec.imageId) : 'NULL'}, 0)`,
    )
    ;(spec.cards ?? []).forEach((card, index) => {
      nextCard += 1
      statements.push(
        `INSERT INTO "card" ("id", "title", "subheading", "value", "short_description", "icon", "cta_label", "cta_url", "tags", "type") VALUES (${nextCard}, ${q(card.title)}, ${nul(card.subheading)}, ${nul(card.value)}, ${nul(card.shortDescription)}, ${nul(card.icon)}, ${nul(card.ctaLabel)}, ${nul(card.ctaUrl)}, ${nul(card.tags)}, ${nul(card.type)})`,
        `INSERT INTO "section_rels" ("order", "parent_id", "path", "card_id") VALUES (${index + 1}, ${id}, 'cards', ${nextCard})`,
      )
    })
    return id
  }

  const relSlugs = async (rels: string, parent: number, path: string, target: string): Promise<string> => {
    const column = target === 'case_study' ? 'case_study_id' : 'blog_id'
    const rows = await read(
      `SELECT t."slug" AS slug FROM "${rels}" r JOIN "${target}" t ON t."id" = r."${column}" WHERE r."parent_id" = ${parent} AND r."path" = '${path}' ORDER BY r."order"`,
    )
    return rows.map((r) => String(r.slug)).join(', ')
  }

  const hasLayout = async (rels: string, parent: number): Promise<boolean> =>
    (await read(`SELECT 1 AS ok FROM "${rels}" WHERE "parent_id" = ${parent} AND "path" = 'layoutSections' LIMIT 1`)).length > 0

  const stackSections = (stacks: Row[], title: string): SectionSpec[] =>
    stacks.map((stack, index) => {
      const base = { key: `stack-${index + 1}`, name: `${title} - ${text(stack.heading) || `Stack ${index + 1}`}`, heading: text(stack.heading), subheading: text(stack.intro), note: text(stack.note) }
      switch (stack.kind) {
        case 'logos':
          return { ...base, type: 'marquee', tags: text(stack.items) }
        case 'chips':
          return { ...base, type: 'chips', variant: Number(stack.tinted) ? 'surface' : '', tags: text(stack.items) }
        case 'cards':
          return { ...base, type: 'cards', variant: 'grid3', cards: cardsFromLines(stack.items) }
        default:
          return { ...base, type: 'table', variant: 'list', cards: rowsFromLines(stack.items) }
      }
    })

  const hero = (doc: Row, kind: 'capability' | 'industry'): SectionSpec => ({
    key: 'hero',
    name: `${text(doc.title)} - Hero`,
    type: 'hero',
    eyebrow: text(doc.eyebrow),
    heading: text(doc.heading) || text(doc.title),
    subheading: text(doc.subheading),
    cta: { label: text(doc.cta_label), href: text(doc.cta_href) },
    secondaryCta: { label: text(doc.secondary_cta_label), href: text(doc.secondary_cta_href) },
    imageId: doc.image_id ? Number(doc.image_id) : null,
    cards: [
      { type: 'breadcrumb', title: label(kind === 'capability' ? 'breadcrumb.capabilities' : 'breadcrumb.industries'), ctaUrl: label(kind === 'capability' ? 'breadcrumb.capabilities.url' : 'breadcrumb.industries.url') },
      { type: 'breadcrumb', title: text(doc.heading) || text(doc.title) },
    ],
  })

  const faq = (doc: Row, faqs: Row[]): SectionSpec | null =>
    faqs.length
      ? { key: 'faq', name: `${text(doc.title)} - FAQ`, type: 'faq', heading: text(doc.faq_heading), cards: faqs.map((f) => ({ title: text(f.question), shortDescription: text(f.answer) })) }
      : null

  const attach = (rels: string, ownerId: number, specs: (SectionSpec | null | false | '' | 0)[]): void => {
    const ids = specs.filter((s): s is SectionSpec => !!s).map(addSection)
    ids.forEach((id, index) => statements.push(`INSERT INTO "${rels}" ("order", "parent_id", "path", "section_id") VALUES (${index + 1}, ${ownerId}, 'layoutSections', ${id})`))
  }

  for (const doc of await read(`SELECT * FROM "capability" ORDER BY "id"`)) {
    const id = Number(doc.id)
    if (await hasLayout('capability_rels', id)) continue
    const included = await read(`SELECT * FROM "capability_included" WHERE "_parent_id" = ${id} ORDER BY "_order"`)
    const stacks = await read(`SELECT * FROM "capability_stacks" WHERE "_parent_id" = ${id} ORDER BY "_order"`)
    const faqs = (await read(`SELECT * FROM "capability_faqs" WHERE "_parent_id" = ${id} ORDER BY "_order"`)).filter((f) => text(f.question))
    const steps = cardsFromLines(doc.workflow)
    const projects = await relSlugs('capability_rels', id, 'relatedProjects', 'case_study')
    const insights = await relSlugs('capability_rels', id, 'relatedInsights', 'blog')
    const title = text(doc.title)
    attach('capability_rels', id, [
      hero(doc, 'capability'),
      included.length > 0 && {
        key: 'included',
        name: `${title} - Included`,
        type: 'cards',
        variant: 'grid2 icons',
        heading: text(doc.included_heading),
        cards: included.map((item) => ({ title: text(item.title), icon: text(item.icon), shortDescription: text(item.text), tags: text(item.tags) })),
      },
      text(doc.why_text) && { key: 'why', name: `${title} - Intro`, type: 'text', variant: 'surface', heading: text(doc.why_heading), subheading: text(doc.why_text) },
      ...stackSections(stacks, title),
      steps.length > 0 && { key: 'workflow', name: `${title} - Workflow`, type: 'steps', variant: 'nodes', eyebrow: text(doc.workflow_eyebrow), heading: text(doc.workflow_heading), subheading: text(doc.workflow_intro), cards: steps },
      projects && { key: 'projects', name: `${title} - Projects`, type: 'projects', variant: 'related', heading: text(doc.projects_heading), tags: projects, cta: { label: label('detail.viewAllProjects'), href: label('detail.viewAllProjects.url') } },
      faq(doc, faqs),
      insights && { key: 'insights', name: `${title} - Insights`, type: 'articles', variant: 'related', heading: text(doc.insights_heading), tags: insights },
    ])
    statements.push(
      `UPDATE "capability" SET "summary" = ${nul(doc.subheading)} WHERE "id" = ${id}`,
      `DELETE FROM "capability_rels" WHERE "parent_id" = ${id} AND "path" IN ('relatedProjects', 'relatedInsights')`,
      `DELETE FROM "capability_included" WHERE "_parent_id" = ${id}`,
      `DELETE FROM "capability_stacks" WHERE "_parent_id" = ${id}`,
      `DELETE FROM "capability_faqs" WHERE "_parent_id" = ${id}`,
      `UPDATE "capability" SET "cta_label" = NULL, "cta_href" = NULL, "secondary_cta_label" = NULL, "secondary_cta_href" = NULL, "image_id" = NULL, "image_alt" = NULL, "eyebrow" = NULL, "included_heading" = NULL, "why_heading" = NULL, "why_text" = NULL, "workflow_eyebrow" = NULL, "workflow_heading" = NULL, "workflow_intro" = NULL, "workflow" = NULL, "projects_heading" = NULL, "insights_heading" = NULL, "faq_heading" = NULL WHERE "id" = ${id}`,
    )
  }

  const industries = await read(`SELECT * FROM "industry" ORDER BY "id"`)
  for (const doc of industries) {
    const id = Number(doc.id)
    if (await hasLayout('industry_rels', id)) continue
    const stacks = await read(`SELECT * FROM "industry_stacks" WHERE "_parent_id" = ${id} ORDER BY "_order"`)
    const faqs = (await read(`SELECT * FROM "industry_faqs" WHERE "_parent_id" = ${id} ORDER BY "_order"`)).filter((f) => text(f.question))
    const projects = await relSlugs('industry_rels', id, 'relatedProjects', 'case_study')
    const title = text(doc.title)
    const stackSpecs = stackSections(stacks, title)
    const process = cardsFromLines(doc.process)
    const disciplines = cardsFromLines(doc.disciplines, true).map((card) => (card.ctaUrl ? { ...card, ctaLabel: label('detail.seeCapability') } : card))
    const others = industries.filter((other) => Number(other.id) !== id)
    attach('industry_rels', id, [
      hero(doc, 'industry'),
      lines(doc.challenges).length > 0 && { key: 'challenges', name: `${title} - Challenges`, type: 'cards', variant: 'grid3', heading: text(doc.challenges_heading), cards: cardsFromLines(doc.challenges) },
      disciplines.length > 0 && { key: 'disciplines', name: `${title} - Disciplines`, type: 'cards', variant: 'grid3 numbered', heading: text(doc.disciplines_heading), cards: disciplines },
      text(doc.callout_heading) && { key: 'one-team', name: `${title} - One team`, type: 'cta-band', variant: 'inline', heading: text(doc.callout_heading), subheading: text(doc.callout_text), cta: { label: text(doc.cta_label), href: text(doc.cta_href) } },
      lines(doc.products).length > 0 && { key: 'products', name: `${title} - Products`, type: 'cards', variant: 'grid4 media', heading: text(doc.products_heading), cards: cardsFromLines(doc.products) },
      ...stackSpecs.filter((s) => s.type !== 'cards'),
      projects && { key: 'projects', name: `${title} - Projects`, type: 'projects', variant: 'related', anchor: 'projects', heading: text(doc.projects_heading), tags: projects },
      process.length > 0 && {
        key: 'how',
        name: `${title} - How we work`,
        type: 'steps',
        variant: 'hover',
        heading: text(doc.process_highlight) ? `${text(doc.process_heading)} **${text(doc.process_highlight)}**`.trim() : text(doc.process_heading),
        cta: { label: text(doc.process_cta_label), href: text(doc.process_cta_href) },
        cards: process,
      },
      ...stackSpecs.filter((s) => s.type === 'cards'),
      faq(doc, faqs),
      others.length > 0 && {
        key: 'others',
        name: `${title} - Other industries`,
        type: 'cards',
        variant: 'grid3 links',
        heading: text(doc.others_heading),
        cards: others.map((other) => ({ title: text(other.title), shortDescription: text(other.summary), ctaUrl: `/industries/${text(other.slug)}/` })),
      },
    ])
    statements.push(
      `DELETE FROM "industry_rels" WHERE "parent_id" = ${id} AND "path" = 'relatedProjects'`,
      `DELETE FROM "industry_stacks" WHERE "_parent_id" = ${id}`,
      `DELETE FROM "industry_faqs" WHERE "_parent_id" = ${id}`,
      `UPDATE "industry" SET "cta_label" = NULL, "cta_href" = NULL, "secondary_cta_label" = NULL, "secondary_cta_href" = NULL, "image_id" = NULL, "image_alt" = NULL, "eyebrow" = NULL, "challenges_heading" = NULL, "challenges" = NULL, "disciplines_heading" = NULL, "disciplines" = NULL, "callout_heading" = NULL, "callout_text" = NULL, "products_heading" = NULL, "products" = NULL, "projects_heading" = NULL, "process_heading" = NULL, "process_highlight" = NULL, "process_cta_label" = NULL, "process_cta_href" = NULL, "process" = NULL, "faq_heading" = NULL, "others_heading" = NULL WHERE "id" = ${id}`,
    )
  }

  const updatedCaseStudies: number[] = []
  for (const doc of await read(`SELECT * FROM "case_study" ORDER BY "id"`)) {
    const id = Number(doc.id)
    const overview = await read(`SELECT * FROM "case_study_overview" WHERE "_parent_id" = ${id} ORDER BY "_order"`)
    const glance = await read(`SELECT * FROM "case_study_at_a_glance" WHERE "_parent_id" = ${id} ORDER BY "_order"`)
    if (!overview.length && !glance.length) continue
    updatedCaseStudies.push(id)
    const groups = await read(`SELECT * FROM "case_study_spec_groups" WHERE "_parent_id" = ${id} ORDER BY "_order"`)
    const title = text(doc.title)
    const existing = await read(
      `SELECT r."section_id" AS id, s."section_key" AS key FROM "case_study_rels" r JOIN "section" s ON s."id" = r."section_id" WHERE r."parent_id" = ${id} AND r."path" = 'layoutSections' ORDER BY r."order"`,
    )
    const byKey = (key: string): number | null => {
      const found = existing.find((e) => String(e.key) === key)
      return found ? Number(found.id) : null
    }
    const order: number[] = []
    const push = (value: number | null): void => {
      if (value) order.push(value)
    }
    if (overview.length)
      push(addSection({ key: 'overview', name: `${title} - Overview`, type: 'cards', variant: 'grid3 summary', cards: overview.map((row) => ({ title: text(row.label), shortDescription: text(row.text) })) }))
    if (glance.length)
      push(addSection({ key: 'glance', name: `${title} - At a glance`, type: 'stats', heading: label('work.glance'), cards: glance.map((row) => ({ type: 'stat', title: text(row.label), value: text(row.value) })) }))
    push(byKey('features'))
    push(byKey('specs-note'))
    for (const group of groups) {
      const rows = await read(`SELECT * FROM "case_study_spec_groups_rows" WHERE "_parent_id" = ${q(group.id)} ORDER BY "_order"`)
      push(
        addSection({
          key: 'spec',
          name: `${title} - ${text(group.heading)}`,
          type: 'table',
          variant: 'spec',
          heading: text(group.heading),
          cards: rows.map((row) => ({ title: text(row.label), value: text(row.value), ...(Number(row.built_in) ? { icon: 'check' } : {}) })),
        }),
      )
    }
    push(byKey('gap'))
    for (const e of existing) if (!order.includes(Number(e.id))) push(Number(e.id))
    statements.push(`DELETE FROM "case_study_rels" WHERE "parent_id" = ${id} AND "path" = 'layoutSections'`)
    order.forEach((sectionId, index) => statements.push(`INSERT INTO "case_study_rels" ("order", "parent_id", "path", "section_id") VALUES (${index + 1}, ${id}, 'layoutSections', ${sectionId})`))
    statements.push(
      `DELETE FROM "case_study_overview" WHERE "_parent_id" = ${id}`,
      `DELETE FROM "case_study_at_a_glance" WHERE "_parent_id" = ${id}`,
      `DELETE FROM "case_study_spec_groups_rows" WHERE "_parent_id" IN (SELECT "id" FROM "case_study_spec_groups" WHERE "_parent_id" = ${id})`,
      `DELETE FROM "case_study_spec_groups" WHERE "_parent_id" = ${id}`,
    )
  }

  const updatedBlogs: number[] = []
  const footerCta = (await read(`SELECT "cta_label" AS label FROM "footer" LIMIT 1`))[0]?.label
  for (const doc of await read(
    `SELECT b."id" AS id, b."title" AS title, b."content_upgrade_label" AS label, c."slug" AS slug FROM "blog" b JOIN "checklist" c ON c."id" = b."content_upgrade_checklist_link_id" WHERE coalesce(b."content_upgrade_label", '') <> ''`,
  )) {
    const id = Number(doc.id)
    const existing = (await read(`SELECT "section_id" AS id FROM "blog_rels" WHERE "parent_id" = ${id} AND "path" = 'layoutSections' ORDER BY "order"`)).map((r) => Number(r.id))
    const sectionId = addSection({ key: 'upgrade', name: `${text(doc.title)} - Checklist`, type: 'cta-band', variant: 'inline', heading: text(doc.label), cta: { label: text(footerCta) || 'Get the Checklist', href: `/resources/${text(doc.slug)}/` } })
    updatedBlogs.push(id)
    statements.push(`DELETE FROM "blog_rels" WHERE "parent_id" = ${id} AND "path" = 'layoutSections'`)
    ;[sectionId, ...existing].forEach((value, index) => statements.push(`INSERT INTO "blog_rels" ("order", "parent_id", "path", "section_id") VALUES (${index + 1}, ${id}, 'layoutSections', ${value})`))
  }
  statements.push(`UPDATE "blog" SET "content_upgrade_label" = NULL, "content_upgrade_checklist_link_id" = NULL WHERE "content_upgrade_label" IS NOT NULL OR "content_upgrade_checklist_link_id" IS NOT NULL`)

  const gate = (await read(`SELECT * FROM "checklist" ORDER BY "id" LIMIT 1`))[0]
  if (gate) {
    const keys: [string, string][] = [
      ['heading', 'access_gate_heading'],
      ['unlockedHeading', 'access_gate_unlocked_heading'],
      ['description', 'access_gate_description'],
      ['unlockedDescription', 'access_gate_unlocked_description'],
      ['emailLabel', 'access_gate_email_label'],
      ['companyLabel', 'access_gate_company_label'],
      ['emailPlaceholder', 'access_gate_email_placeholder'],
      ['emailHelper', 'access_gate_email_helper'],
      ['companyPlaceholder', 'access_gate_company_placeholder'],
      ['submitLabel', 'access_gate_submit_label'],
      ['privacyNote', 'access_gate_privacy_note'],
      ['lockedActionLabel', 'access_gate_locked_action_label'],
      ['progressConnector', 'access_gate_progress_connector'],
      ['progressSuffix', 'access_gate_progress_suffix'],
      ['validationError', 'access_gate_validation_error'],
    ]
    let order = Number((await read(`SELECT coalesce(max("_order"), 0) AS n FROM "site_chrome_ui_labels"`))[0]?.n ?? 0)
    for (const [name, column] of keys) {
      if (labels.has(`checklist.gate.${name}`)) continue
      order += 1
      statements.push(
        `INSERT INTO "site_chrome_ui_labels" ("_order", "_parent_id", "id", "key", "value") VALUES (${order}, 1, lower(hex(randomblob(12))), ${q(`checklist.gate.${name}`)}, ${q(text(gate[column]))})`,
      )
    }
    statements.push(
      `DELETE FROM "site_chrome_ui_labels" WHERE "key" IN ('checklist.mock.title', 'checklist.mock.body', 'checklist.unlock', 'checklist.unlockLong')`,
      `UPDATE "checklist" SET ${keys.map(([, column]) => `"${column}" = NULL`).join(', ')}, "form_id" = NULL`,
    )
  }

  statements.push(`DELETE FROM "page_rels" WHERE "path" = 'relatedCaseStudies'`)

  const versionTables = (await read(`SELECT "name" FROM "sqlite_master" WHERE "type" = 'table' AND "name" = '_page_v_rels'`)).length
  if (versionTables) statements.push(`DELETE FROM "_page_v_rels" WHERE "path" = 'version.relatedCaseStudies'`)

  statements.push(...(await buildVersionRepair(read, { replace: { case_study: updatedCaseStudies, blog: updatedBlogs } })))
  return { statements }
}

export async function applyRestructure(db: MigrateUpArgs['db']): Promise<void> {
  const read: Reader = async (query) => (await db.all(sql.raw(query))) as Row[]
  for (const statement of await ensureRestructureSchema(read)) await db.run(sql.raw(statement))
  const plan = await buildRestructure(read)
  for (const statement of plan.statements) await db.run(sql.raw(statement))
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await applyRestructure(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  void db
}

import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-d1-sqlite'
import { projectContent, type ProjectBlock } from './data/projects'
import { buildVersionRepair } from '../utilities/versionRepair'

export type Row = Record<string, unknown>
export type Reader = (query: string) => Promise<Row[]>

export interface CleanupPlan {
  statements: string[]
  removedMedia: string[]
}

const q = (value: unknown): string => `'${String(value ?? '').replace(/'/g, "''")}'`

const textNode = (text: string) => ({ type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text, version: 1 })

const lexicalBody = (blocks: ProjectBlock[]): string =>
  JSON.stringify({
    root: {
      type: 'root',
      children: blocks.map((block) =>
        block.kind === 'p'
          ? { type: 'paragraph', children: [textNode(block.text)], direction: null as string | null, format: '', indent: 0, textFormat: 0, textStyle: '', version: 1 }
          : { type: 'heading', tag: block.kind, children: [textNode(block.text)], direction: null as string | null, format: '', indent: 0, version: 1 },
      ),
      direction: null as string | null,
      format: '',
      indent: 0,
      version: 1,
    },
  })

const SECTION_LEGACY = [
  'heading_first_line',
  'heading_second_line',
  'summary',
  'tag_line',
  'highlight',
  'columns',
  'image_url',
  'logo',
  'background_image',
  'background_video',
  'image_alt',
  'preview_alt',
]

const CARD_LEGACY = ['heading', 'index', 'category', 'role', 'date', 'image_url', 'image_alt', 'theme', 'additional_description', 'body', 'read_more_label', 'linkedin_url']

const TEXT_TABLES = new Set(['site_chrome_ui_labels', 'capability_stacks', 'industry_stacks', 'section', 'card', 'footer_link_groups_links', 'header_nav_items', 'header_nav_items_children'])

const MEDIA_REFERENCE = /(^|_)(image|logo|icon|photo|pdf_asset|media|landing_image|hero_image|og_image)_id$|^(primary|secondary)_logo_id$/

async function unionRows(read: Reader, parts: string[], joiner: string): Promise<Row[]> {
  const rows: Row[] = []
  for (let i = 0; i < parts.length; i += 5) rows.push(...(await read(parts.slice(i, i + 5).join(joiner))))
  return rows
}

export async function unusedMedia(read: Reader): Promise<Row[]> {
  const columns = await read(
    `SELECT m.name AS tbl, p.name AS col, p.type AS type FROM sqlite_master m JOIN pragma_table_info(m.name) p WHERE m.type = 'table' AND m.name NOT LIKE 'sqlite_%' AND m.name NOT LIKE '_cf_%' AND m.name NOT LIKE 'payload_%' AND m.name <> 'media'`,
  )
  const refs = columns.filter((c) => MEDIA_REFERENCE.test(String(c.col)))
  const texts = columns.filter((c) => TEXT_TABLES.has(String(c.tbl)) && String(c.type).toLowerCase().includes('text'))
  const used = new Set<number>()
  if (refs.length) {
    const parts = refs.map((c) => `SELECT "${c.col}" AS id FROM "${c.tbl}" WHERE "${c.col}" IS NOT NULL`)
    for (const row of await unionRows(read, parts, ' UNION ')) used.add(Number(row.id))
  }
  let haystack = ''
  if (texts.length) {
    const parts = texts.map((c) => `SELECT "${c.col}" AS v FROM "${c.tbl}" WHERE typeof("${c.col}") = 'text' AND "${c.col}" LIKE '%/api/media/file/%'`)
    haystack = (await unionRows(read, parts, ' UNION ALL ')).map((row) => String(row.v)).join('\n')
    try {
      haystack = decodeURIComponent(haystack.replace(/%(?![0-9A-Fa-f]{2})/g, '%25'))
    } catch {
      haystack = haystack.replace(/%20/g, ' ')
    }
  }
  return (await read(`SELECT "id", "filename" FROM "media"`)).filter((m) => !used.has(Number(m.id)) && !haystack.includes(String(m.filename)))
}

export async function buildProjectContentAndCleanup(read: Reader): Promise<CleanupPlan> {
  const statements: string[] = []
  const updatedProjects: number[] = []

  for (const project of projectContent) {
    const found = await read(`SELECT "id" FROM "case_study" WHERE "slug" = ${q(project.slug)}`)
    if (!found.length) continue
    const id = Number(found[0].id)
    updatedProjects.push(id)

    statements.push(
      `UPDATE "case_study" SET "subheading" = ${q(project.subheading)}, "category" = ${q(project.category)}, "featured" = ${project.featured ? 1 : 0}, "project_stage" = ${q(project.projectStage)}, "tags" = ${q(project.tags)}, "body" = ${q(lexicalBody(project.body))} WHERE "id" = ${id}`,
      `DELETE FROM "case_study_overview" WHERE "_parent_id" = ${id}`,
      `DELETE FROM "case_study_at_a_glance" WHERE "_parent_id" = ${id}`,
      `DELETE FROM "case_study_spec_groups_rows" WHERE "_parent_id" IN (SELECT "id" FROM "case_study_spec_groups" WHERE "_parent_id" = ${id})`,
      `DELETE FROM "case_study_spec_groups" WHERE "_parent_id" = ${id}`,
    )
    project.overview.forEach((row, index) =>
      statements.push(
        `INSERT INTO "case_study_overview" ("_order", "_parent_id", "id", "label", "text") VALUES (${index + 1}, ${id}, ${q(`p${id}-overview-${index + 1}`)}, ${q(row.label)}, ${q(row.text)})`,
      ),
    )
    project.atAGlance.forEach((row, index) =>
      statements.push(
        `INSERT INTO "case_study_at_a_glance" ("_order", "_parent_id", "id", "label", "value") VALUES (${index + 1}, ${id}, ${q(`p${id}-glance-${index + 1}`)}, ${q(row.label)}, ${q(row.value)})`,
      ),
    )
    project.specGroups.forEach((group, groupIndex) => {
      const groupId = `p${id}-spec-${groupIndex + 1}`
      statements.push(
        `INSERT INTO "case_study_spec_groups" ("_order", "_parent_id", "id", "heading") VALUES (${groupIndex + 1}, ${id}, ${q(groupId)}, ${q(group.heading)})`,
      )
      group.rows.forEach((row, rowIndex) =>
        statements.push(
          `INSERT INTO "case_study_spec_groups_rows" ("_order", "_parent_id", "id", "label", "value", "built_in") VALUES (${rowIndex + 1}, ${q(groupId)}, ${q(`${groupId}-row-${rowIndex + 1}`)}, ${q(row.label)}, ${row.value ? q(row.value) : 'NULL'}, ${row.builtIn ? 1 : 0})`,
        ),
      )
    })

    statements.push(
      `UPDATE "section" SET "heading" = ${q(project.highlights.heading)}, "subheading" = ${q(project.highlights.text)} WHERE "section_key" = 'features' AND "id" IN (SELECT "section_id" FROM "case_study_rels" WHERE "parent_id" = ${id} AND "section_id" IS NOT NULL)`,
    )
    const gapSections = await read(
      `SELECT s."id" AS id FROM "section" s WHERE s."section_key" = 'gap' AND s."id" IN (SELECT "section_id" FROM "case_study_rels" WHERE "parent_id" = ${id} AND "section_id" IS NOT NULL)`,
    )
    if (gapSections.length) {
      const gapId = Number(gapSections[0].id)
      statements.push(`UPDATE "section" SET "heading" = ${q(project.gap.heading)} WHERE "id" = ${gapId}`)
      const cardIds = (await read(`SELECT "card_id" FROM "section_rels" WHERE "parent_id" = ${gapId} AND "card_id" IS NOT NULL ORDER BY "order"`)).map((r) => Number(r.card_id))
      project.gap.cards.forEach((card, index) => {
        if (cardIds[index] === undefined) return
        statements.push(`UPDATE "card" SET "title" = ${q(card.title)}, "short_description" = ${q(card.text)} WHERE "id" = ${cardIds[index]}`)
      })
    }
  }

  statements.push(`DELETE FROM "page_workflow_steps"`, `DELETE FROM "_page_v_version_workflow_steps"`)
  statements.push(`UPDATE "section" SET ${SECTION_LEGACY.map((column) => `"${column}" = NULL`).join(', ')}`)
  statements.push(`UPDATE "card" SET ${CARD_LEGACY.map((column) => `"${column}" = NULL`).join(', ')}`)

  const removed = await unusedMedia(read)
  if (removed.length) {
    const ids = removed.map((m) => Number(m.id)).join(', ')
    statements.push(`DELETE FROM "payload_locked_documents_rels" WHERE "media_id" IN (${ids})`, `DELETE FROM "media" WHERE "id" IN (${ids})`)
  }

  statements.push(...(await buildVersionRepair(read, { replace: { case_study: updatedProjects } })))

  return { statements, removedMedia: removed.map((m) => String(m.filename)) }
}

export async function applyProjectContentAndCleanup(db: MigrateUpArgs['db']): Promise<void> {
  const plan = await buildProjectContentAndCleanup(async (query) => (await db.all(sql.raw(query))) as Row[])
  for (const statement of plan.statements) await db.run(sql.raw(statement))
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await applyProjectContentAndCleanup(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  void db
}

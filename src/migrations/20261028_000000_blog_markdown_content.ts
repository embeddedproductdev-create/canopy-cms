import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-d1-sqlite'
import { sql } from '@payloadcms/db-d1-sqlite'

type Column = { name: string }
type BlogRow = { id: number; body: string | null; content: string | null }
type Db = MigrateUpArgs['db']

const columns = [
  { table: 'blog', name: 'teaser', definition: 'text' },
  { table: 'blog', name: 'published_at', definition: 'text' },
  { table: 'blog', name: 'meta_title', definition: 'text' },
  { table: 'blog', name: 'meta_description', definition: 'text' },
  { table: 'blog', name: 'content', definition: 'text' },
  { table: '_blog_v', name: 'version_teaser', definition: 'text' },
  { table: '_blog_v', name: 'version_published_at', definition: 'text' },
  { table: '_blog_v', name: 'version_meta_title', definition: 'text' },
  { table: '_blog_v', name: 'version_meta_description', definition: 'text' },
  { table: '_blog_v', name: 'version_content', definition: 'text' },
]

function inlineMarkdown(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const node = value as Record<string, unknown>
  if (typeof node.text === 'string') {
    let text = node.text
    const format = typeof node.format === 'number' ? node.format : 0
    if (format & 16) text = `\`${text}\``
    if (format & 8) text = `<u>${text}</u>`
    if (format & 4) text = `~~${text}~~`
    if (format & 2) text = `*${text}*`
    if (format & 1) text = `**${text}**`
    return text
  }
  const children = Array.isArray(node.children) ? node.children.map(inlineMarkdown).join('') : ''
  if (node.type === 'link' || node.type === 'autolink') {
    const url = typeof node.url === 'string' ? node.url : ''
    return url ? `[${children}](${url})` : children
  }
  return children
}

function blockMarkdown(value: unknown, depth = 0): string {
  if (!value || typeof value !== 'object') return ''
  const node = value as Record<string, unknown>
  const children = Array.isArray(node.children) ? node.children : []
  const type = node.type
  if (type === 'heading') {
    const level = node.tag === 'h3' ? '###' : '##'
    return `${level} ${inlineMarkdown(node)}`
  }
  if (type === 'paragraph') return inlineMarkdown(node)
  if (type === 'quote') return inlineMarkdown(node).split('\n').map((line) => `> ${line}`).join('\n')
  if (type === 'horizontalrule') return '---'
  if (type === 'list') {
    const ordered = node.listType === 'number'
    return children
      .map((child, index) => {
        const content = blockMarkdown(child, depth + 1).replace(/\n/g, '\n  ')
        return `${'  '.repeat(depth)}${ordered ? `${index + 1}.` : '-'} ${content}`
      })
      .join('\n')
  }
  if (type === 'listitem') return children.map((child) => blockMarkdown(child, depth)).filter(Boolean).join('')
  if (type === 'table') {
    const rows = children.map((row) => {
      const cells = (Array.isArray((row as Record<string, unknown>).children)
        ? (row as Record<string, unknown>).children as unknown[]
        : []).map((cell) => inlineMarkdown(cell).replace(/\|/g, '\\|'))
      return `| ${cells.join(' | ')} |`
    })
    if (rows.length > 1) rows.splice(1, 0, `| ${rows[0].split('|').slice(1, -1).map(() => '---').join(' | ')} |`)
    return rows.join('\n')
  }
  return children.map((child) => blockMarkdown(child, depth)).filter(Boolean).join('\n\n')
}

export function legacyBodyToMarkdown(body: string | null): string {
  if (!body) return ''
  try {
    const parsed: unknown = JSON.parse(body)
    if (!parsed || typeof parsed !== 'object') return body
    const root = parsed as Record<string, unknown>
    const children = Array.isArray(root.root)
      ? root.root
      : root.root && typeof root.root === 'object' && Array.isArray((root.root as Record<string, unknown>).children)
        ? (root.root as Record<string, unknown>).children as unknown[]
        : []
    return children.map((child) => blockMarkdown(child)).filter(Boolean).join('\n\n')
  } catch {
    return body
  }
}

export async function applyBlogMarkdownContent(db: Db): Promise<void> {
  const existingTables = new Set(
    ((await db.all(sql`SELECT "name" FROM "sqlite_master" WHERE "type" = 'table'`)) as Column[]).map((row) => row.name),
  )

  for (const column of columns) {
    if (!existingTables.has(column.table)) continue
    const existingColumns = (await db.all(sql.raw(`PRAGMA table_info("${column.table}")`))) as Column[]
    if (existingColumns.some((row) => row.name === column.name)) continue
    await db.run(sql.raw(`ALTER TABLE "${column.table}" ADD COLUMN "${column.name}" ${column.definition}`))
  }

  if (existingTables.has('blog')) {
    await db.run(sql`
      UPDATE "blog"
      SET "teaser" = COALESCE(NULLIF("teaser", ''), "dek"),
          "published_at" = COALESCE("published_at", "published_date"),
          "meta_title" = COALESCE(NULLIF("meta_title", ''), "seo_seo_title"),
          "meta_description" = COALESCE(NULLIF("meta_description", ''), "seo_meta_description")
    `)
    const rows = (await db.all(sql`SELECT "id", "body", "content" FROM "blog"`)) as BlogRow[]
    for (const row of rows) {
      if (row.content) continue
      const content = legacyBodyToMarkdown(row.body)
      if (content) await db.run(sql`UPDATE "blog" SET "content" = ${content} WHERE "id" = ${row.id}`)
    }
  }

  if (existingTables.has('_blog_v')) {
    await db.run(sql`
      UPDATE "_blog_v"
      SET "version_teaser" = COALESCE(NULLIF("version_teaser", ''), "version_dek"),
          "version_published_at" = COALESCE("version_published_at", "version_published_date"),
          "version_meta_title" = COALESCE(NULLIF("version_meta_title", ''), "version_seo_seo_title"),
          "version_meta_description" = COALESCE(NULLIF("version_meta_description", ''), "version_seo_meta_description")
    `)
    const rows = (await db.all(
      sql`SELECT "id", "version_body" AS "body", "version_content" AS "content" FROM "_blog_v"`,
    )) as BlogRow[]
    for (const row of rows) {
      if (row.content) continue
      const content = legacyBodyToMarkdown(row.body)
      if (content) {
        await db.run(sql`UPDATE "_blog_v" SET "version_content" = ${content} WHERE "id" = ${row.id}`)
      }
    }
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await applyBlogMarkdownContent(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  void db
}

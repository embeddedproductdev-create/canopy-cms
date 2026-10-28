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

export type Reader = (query: string) => Promise<Record<string, unknown>[]>

const literal = (value: string) => `'${value.replace(/'/g, "''")}'`

/** The SQL this migration needs, so it can run through Payload or straight against D1 with wrangler. */
export async function buildBlogMarkdownContent(read: Reader): Promise<string[]> {
  const statements: string[] = []
  const existingTables = new Set((await read(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('blog', '_blog_v')`)).map((row) => String(row.name)))
  const columnsOf = async (table: string) => new Set((await read(`SELECT name FROM pragma_table_info('${table}')`)).map((row) => String(row.name)))
  const have: Record<string, Set<string>> = {}

  for (const table of existingTables) have[table] = await columnsOf(table)
  for (const column of columns) {
    if (!existingTables.has(column.table) || have[column.table].has(column.name)) continue
    statements.push(`ALTER TABLE "${column.table}" ADD COLUMN "${column.name}" ${column.definition}`)
  }

  const targets: { table: string; prefix: string }[] = [
    { table: 'blog', prefix: '' },
    { table: '_blog_v', prefix: 'version_' },
  ]
  for (const { table, prefix } of targets) {
    if (!existingTables.has(table)) continue
    statements.push(
      `UPDATE "${table}" SET "${prefix}teaser" = COALESCE(NULLIF("${prefix}teaser", ''), "${prefix}dek"), ` +
        `"${prefix}published_at" = COALESCE("${prefix}published_at", "${prefix}published_date"), ` +
        `"${prefix}meta_title" = COALESCE(NULLIF("${prefix}meta_title", ''), "${prefix}seo_seo_title"), ` +
        `"${prefix}meta_description" = COALESCE(NULLIF("${prefix}meta_description", ''), "${prefix}seo_meta_description")`,
    )
    const contentColumn = `${prefix}content`
    const select = have[table].has(contentColumn)
      ? `SELECT "id", "${prefix}body" AS "body", "${contentColumn}" AS "content" FROM "${table}"`
      : `SELECT "id", "${prefix}body" AS "body", NULL AS "content" FROM "${table}"`
    for (const row of (await read(select)) as unknown as BlogRow[]) {
      if (row.content) continue
      const content = legacyBodyToMarkdown(row.body)
      if (content) statements.push(`UPDATE "${table}" SET "${contentColumn}" = ${literal(content)} WHERE "id" = ${Number(row.id)}`)
    }
  }
  return statements
}

export async function applyBlogMarkdownContent(db: Db): Promise<void> {
  const read: Reader = async (query) => (await db.all(sql.raw(query))) as Record<string, unknown>[]
  for (const statement of await buildBlogMarkdownContent(read)) await db.run(sql.raw(statement))
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await applyBlogMarkdownContent(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  void db
}

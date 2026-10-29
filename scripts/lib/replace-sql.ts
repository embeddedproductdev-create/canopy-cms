export type Row = Record<string, unknown>
export type FkEdge = { child: string; parent: string }

const quote = (value: unknown): string => {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  return `'${String(value).replace(/'/g, "''")}'`
}

// Children first, so no table is dropped while another table still points at it.
export function dropOrder(tables: string[], edges: FkEdge[]): string[] {
  const remaining = new Set(tables)
  const ordered: string[] = []
  while (remaining.size) {
    const ready = [...remaining].filter((table) => !edges.some((edge) => edge.parent === table && edge.child !== table && remaining.has(edge.child)))
    const batch = ready.length ? ready : [...remaining]
    for (const table of batch) {
      remaining.delete(table)
      ordered.push(table)
    }
  }
  return ordered
}

/** Splits SQL into statements at `;`, ignoring semicolons inside '...', "..." and `...` (values may span lines). */
export function splitStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let quote = ''
  for (const char of sql) {
    if (quote) {
      current += char
      if (char === quote) quote = ''
    } else if (char === "'" || char === '"' || char === '`') {
      quote = char
      current += char
    } else if (char === ';') {
      if (current.trim()) statements.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  if (current.trim()) statements.push(current.trim())
  return statements
}

const insertTarget = (statement: string): string | null => /^INSERT\s+INTO\s+["`]?([^"`\s(]+)["`]?/i.exec(statement)?.[1] ?? null

/** Rows the seed adds to each table (one INSERT per row, as `sqlite3 .dump` writes them). */
export function expectedRowCounts(seed: string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const statement of splitStatements(seed)) {
    const table = insertTarget(statement)
    if (table) counts[table] = (counts[table] ?? 0) + 1
  }
  return counts
}

// Parents first, using the foreign keys the seed itself declares (the remote's keys describe the old schema).
function insertOrder(structure: string[], tables: string[]): string[] {
  const edges: FkEdge[] = []
  for (const statement of structure) {
    const child = /^CREATE\s+TABLE\s+["`]?([^"`\s(]+)/i.exec(statement)?.[1]
    if (!child) continue
    for (const match of statement.matchAll(/REFERENCES\s+["`]?([^"`\s(]+)/gi)) edges.push({ child, parent: match[1] })
  }
  return dropOrder(tables, edges).reverse()
}

/**
 * The same replacement as buildReplaceSql, cut into several small imports so no single D1 import has to drop, create
 * and fill the whole database. The first chunk is one atomic step (drop, create, kept rows); the rest only insert
 * seed rows, parents before children, each capped at roughly maxBytes.
 */
export type ColumnInfo = { name: string; type: string }

// Column names a seed CREATE TABLE declares (sqlite .dump writes one backticked or quoted column per definition).
function seedColumns(structure: string[], table: string): Set<string> {
  const create = structure.find((statement) => /^CREATE\s+TABLE\s+["`]?([^"`\s(]+)/i.exec(statement)?.[1] === table)
  const names = new Set<string>()
  for (const match of create?.matchAll(/(?:^|[(,]\s*)["`]([^"`]+)["`]\s+[A-Za-z]/g) ?? []) names.add(match[1])
  return names
}

export function buildReplaceChunks(
  tables: string[],
  edges: FkEdge[],
  kept: Record<string, Row[]>,
  seed: string,
  maxBytes = 100_000,
  keptSchema: Record<string, ColumnInfo[]> = {},
): string[] {
  const statements = splitStatements(seed).filter((statement) => !/^PRAGMA\b/i.test(statement))
  const inserts = statements.filter((statement) => insertTarget(statement))
  const structure = statements.filter((statement) => /^CREATE\s/i.test(statement))
  const after = statements.filter((statement) => !insertTarget(statement) && !/^CREATE\s/i.test(statement))
  const keptTables = new Set(Object.entries(kept).filter(([, rows]) => rows.length).map(([table]) => table))

  const first = ['PRAGMA defer_foreign_keys = ON;', ...dropOrder(tables, edges).map((table) => `DROP TABLE IF EXISTS "${table}";`), ...structure.map((statement) => `${statement};`)]
  // Rows kept from a database that was migrated after the seed was written carry columns the seed's table lacks
  // (user.reset_password_requested_at, form_submission.phone). Add them first so those rows, and their data, fit.
  for (const table of keptTables) {
    const known = seedColumns(structure, table)
    for (const column of keptSchema[table] ?? []) {
      if (!known.has(column.name)) first.push(`ALTER TABLE "${table}" ADD COLUMN "${column.name}" ${column.type || 'text'};`)
    }
  }
  for (const table of keptTables) {
    for (const row of kept[table]) {
      const columns = Object.keys(row)
      first.push(`INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${columns.map((column) => quote(row[column])).join(', ')});`)
    }
  }

  const seeded = [...new Set(inserts.map((statement) => insertTarget(statement)!))]
  const rank = new Map(insertOrder(structure, seeded).map((table, index) => [table, index]))
  const data = inserts
    .filter((statement) => !keptTables.has(insertTarget(statement)!))
    .map((statement, index) => ({ statement, index, rank: rank.get(insertTarget(statement)!) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)

  const chunks = [first.join('\n') + '\n']
  let current: string[] = []
  let size = 0
  for (const { statement } of data) {
    if (current.length && size + statement.length > maxBytes) {
      chunks.push(['PRAGMA defer_foreign_keys = ON;', ...current].join('\n') + '\n')
      current = []
      size = 0
    }
    current.push(`${statement};`)
    size += statement.length + 1
  }
  if (current.length) chunks.push(['PRAGMA defer_foreign_keys = ON;', ...current].join('\n') + '\n')
  // Statements such as the seed's trailing UPDATEs work on the rows above, so they run last, in their original order.
  if (after.length) chunks.push(after.map((statement) => `${statement};`).join('\n') + '\n')
  return chunks
}

export function buildReplaceSql(tables: string[], edges: FkEdge[], kept: Record<string, Row[]>, seed: string): string {
  const lines = ['PRAGMA defer_foreign_keys = ON;', ...dropOrder(tables, edges).map((table) => `DROP TABLE IF EXISTS "${table}";`), seed]
  for (const [table, rows] of Object.entries(kept)) {
    if (!rows.length) continue
    lines.push(`DELETE FROM "${table}";`)
    for (const row of rows) {
      const columns = Object.keys(row)
      lines.push(`INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${columns.map((column) => quote(row[column])).join(', ')});`)
    }
  }
  return lines.join('\n') + '\n'
}

/** One simple count per table. D1 allows only a handful of terms in a compound SELECT, so never join them with UNION. */
export function countStatements(tables: string[]): string[] {
  return tables.map((table) => `SELECT '${table}' AS t, count(*) AS n FROM "${table}"`)
}

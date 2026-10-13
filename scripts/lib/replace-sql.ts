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

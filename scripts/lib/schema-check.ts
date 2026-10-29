export type ActualColumn = { t: string; c: string }

/**
 * Tables and columns Payload expects that the database does not have. Extra tables or columns are fine: they are
 * left over from older layouts and do no harm. A database with gaps makes the admin list render blank, because
 * the query fails on the server and Payload shows nothing.
 */
export function findSchemaGaps(expected: Record<string, string[]>, actual: ActualColumn[]): string[] {
  const have = new Map<string, Set<string>>()
  for (const { t, c } of actual) {
    if (!have.has(t)) have.set(t, new Set())
    have.get(t)!.add(c)
  }
  const gaps: string[] = []
  for (const [table, columns] of Object.entries(expected)) {
    const present = have.get(table)
    if (!present) {
      gaps.push(`table ${table}`)
      continue
    }
    for (const column of columns) if (!present.has(column)) gaps.push(`${table}.${column}`)
  }
  return gaps
}

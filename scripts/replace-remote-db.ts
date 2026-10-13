import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'

// Replaces the content of the remote D1 with seed/db-dump.sql. Admin users and form submissions that exist
// on the remote are kept (they are not part of the seed). Pass --yes to run; without it only a report is printed.
const execute = process.argv.includes('--yes')
const KEEP = ['user', 'form_submission']
const wrangler = path.resolve('node_modules/wrangler/bin/wrangler.js')
const seed = path.resolve('seed/db-dump.sql')

type Row = Record<string, unknown>

function d1(args: string[]): string {
  try {
    return execFileSync(process.execPath, [wrangler, 'd1', 'execute', 'D1', '--remote', ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    throw new Error(`wrangler failed: ${String((error as { stdout?: string }).stdout ?? error).replace(/\s+/g, ' ').slice(0, 500)}`)
  }
}

function read(query: string): Row[] {
  const out = d1(['--json', '--command', query])
  const start = out.indexOf('[')
  if (start === -1) throw new Error(`Unexpected wrangler output: ${out.slice(0, 300)}`)
  return (JSON.parse(out.slice(start)) as { results?: Row[] }[])[0]?.results ?? []
}

const quote = (value: unknown): string => {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  return `'${String(value).replace(/'/g, "''")}'`
}

if (!fs.existsSync(seed)) throw new Error('seed/db-dump.sql is missing.')

const tables = read("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").map((row) => String(row.name))
const kept: Record<string, Row[]> = {}
for (const table of KEEP) if (tables.includes(table)) kept[table] = read(`SELECT * FROM "${table}"`)

console.log(`Remote tables to replace: ${tables.length}`)
for (const table of KEEP) console.log(`  keeping ${kept[table]?.length ?? 0} row(s) of ${table}`)

if (!execute) {
  console.log('\nDry run only. Re-run with --yes to replace the remote database content.')
  process.exit(0)
}

const lines = ['PRAGMA defer_foreign_keys = ON;', ...tables.map((table) => `DROP TABLE IF EXISTS "${table}";`), fs.readFileSync(seed, 'utf8')]
for (const table of KEEP) {
  const rows = kept[table]
  if (!rows?.length) continue
  lines.push(`DELETE FROM "${table}";`)
  for (const row of rows) {
    const columns = Object.keys(row)
    lines.push(`INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${columns.map((column) => quote(row[column])).join(', ')});`)
  }
}

fs.mkdirSync('.sync', { recursive: true })
const file = path.resolve('.sync/replace.sql')
fs.writeFileSync(file, lines.join('\n') + '\n')
console.log(`Importing ${(fs.statSync(file).size / 1024 / 1024).toFixed(1)} MB into the remote database ...`)
d1(['--file', file, '-y'])
console.log('Remote database content replaced.')
process.exit(0)

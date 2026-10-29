import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { buildReplaceChunks, CONTENT_TABLES, countStatements, dataLossReport, expectedRowCounts, type ColumnInfo, type FkEdge, type Row } from './lib/replace-sql'
import { runWithRetry } from './lib/retry'

// Replaces the content of the remote D1 with seed/db-dump.sql. Admin users and form submissions that exist
// on the remote are kept (they are not part of the seed). Pass --yes to run; without it only a report is printed.
const execute = process.argv.includes('--yes')
// `--local` rehearses the whole replacement against the local D1 (no Cloudflare login needed).
const target = process.argv.includes('--local') ? '--local' : '--remote'
const KEEP = ['user', 'form_submission']
const wrangler = path.resolve('node_modules/wrangler/bin/wrangler.js')
const seed = path.resolve('seed/db-dump.sql')

function d1(args: string[]): string {
  try {
    return execFileSync(process.execPath, [wrangler, 'd1', 'execute', 'D1', target, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; status?: number }
    const output = `${failure.stdout ?? ''}\n${failure.stderr ?? ''}`.replace(/\s+/g, ' ').trim()
    throw new Error(`wrangler exited with status ${failure.status ?? '?'}. Last output: ${output.slice(-2500)}`)
  }
}

function read(query: string): Row[] {
  const out = d1(['--json', '--command', query])
  const start = out.indexOf('[')
  if (start === -1) throw new Error(`Unexpected wrangler output: ${out.slice(0, 300)}`)
  return (JSON.parse(out.slice(start)) as { results?: Row[] }[])[0]?.results ?? []
}

if (!fs.existsSync(seed)) throw new Error('seed/db-dump.sql is missing.')

const tables = read("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").map((row) => String(row.name))
const edges = read("SELECT m.name AS child, f.\"table\" AS parent FROM sqlite_master m, pragma_foreign_key_list(m.name) f WHERE m.type = 'table' AND m.name NOT LIKE 'sqlite_%' AND m.name NOT LIKE '_cf_%'").map((row) => ({ child: String(row.child), parent: String(row.parent) })) as FkEdge[]
const kept: Record<string, Row[]> = {}
const keptSchema: Record<string, ColumnInfo[]> = {}
for (const table of KEEP) {
  if (!tables.includes(table)) continue
  kept[table] = read(`SELECT * FROM "${table}"`)
  keptSchema[table] = read(`SELECT name, type FROM pragma_table_info('${table}')`).map((row) => ({ name: String(row.name), type: String(row.type ?? '') }))
}

console.log(`Remote tables to replace: ${tables.length} (${edges.length} foreign keys)`)
for (const table of KEEP) console.log(`  keeping ${kept[table]?.length ?? 0} row(s) of ${table}`)

// A seed with fewer posts, projects or media than the live database means live edits would be deleted.
const live: Record<string, number> = {}
const liveTables = CONTENT_TABLES.filter((table) => tables.includes(table))
const liveOut = d1(['--json', '--command', countStatements(liveTables).join('; ')])
for (const set of JSON.parse(liveOut.slice(liveOut.indexOf('['))) as { results?: Row[] }[]) for (const row of set.results ?? []) live[String(row.t)] = Number(row.n)
const loss = dataLossReport(live, expectedRowCounts(fs.readFileSync(seed, 'utf8')))
if (loss.length) {
  console.log(`\nThe seed has less content than the ${target.slice(2)} database:\n${loss.map((line) => `  ${line}`).join('\n')}`)
  if (!process.argv.includes('--allow-data-loss')) {
    throw new Error('Refusing to replace the database: it would delete content. Restore the seed first, or pass --allow-data-loss (workflow input allow_data_loss) if that is intended.')
  }
  console.log('--allow-data-loss given, continuing.')
}

if (!execute) {
  console.log('\nDry run only. Re-run with --yes to replace the remote database content.')
  process.exit(0)
}

// One big import can make D1 reset the database (D1_RESET_DO), so the replacement is sent as several small imports:
// the first drops, creates and restores the kept rows in one step, the others only add seed rows. A transient
// failure is retried; rerunning the whole script is always safe because the first chunk starts from a clean slate.
const seedSql = fs.readFileSync(seed, 'utf8')
const chunks = buildReplaceChunks(tables, edges, kept, seedSql, undefined, keptSchema)
fs.mkdirSync('.sync', { recursive: true })
const files = chunks.map((chunk, index) => {
  const file = path.resolve(`.sync/replace-${String(index).padStart(2, '0')}.sql`)
  fs.writeFileSync(file, chunk)
  return file
})
const megabytes = chunks.reduce((total, chunk) => total + chunk.length, 0) / 1024 / 1024
console.log(`Importing ${megabytes.toFixed(1)} MB into the ${target.slice(2)} database in ${files.length} steps ...`)
for (const [index, file] of files.entries()) {
  await runWithRetry(() => d1(['--file', file, '-y']))
  console.log(`  step ${index + 1}/${files.length} done`)
}

const keptWithRows = new Set(Object.entries(kept).filter(([, rows]) => rows.length).map(([table]) => table))
const expected = Object.entries(expectedRowCounts(seedSql)).filter(([table]) => !keptWithRows.has(table))
// Several statements in one call (each returns its own result set), 20 at a time to stay well inside D1's limits.
const actual = new Map<string, number>()
const countSql = countStatements(expected.map(([table]) => table))
for (let start = 0; start < countSql.length; start += 20) {
  const out = d1(['--json', '--command', countSql.slice(start, start + 20).join('; ')])
  const sets = JSON.parse(out.slice(out.indexOf('['))) as { results?: Row[] }[]
  for (const set of sets) for (const row of set.results ?? []) actual.set(String(row.t), Number(row.n))
}
const wrong = expected.filter(([table, count]) => actual.get(table) !== count).map(([table, count]) => `${table}: expected ${count}, found ${actual.get(table) ?? 'none'}`)
if (wrong.length) throw new Error(`Row counts differ after the import:\n${wrong.join('\n')}`)
console.log(`Remote database content replaced (${expected.length} tables checked).`)
process.exit(0)

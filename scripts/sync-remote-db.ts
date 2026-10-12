import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { DatabaseSync } from 'node:sqlite'
import { migrations } from '../src/migrations'
import { readWranglerConfig } from './lib/wrangler-config'

const args = new Set(process.argv.slice(2))
const execute = args.has('--yes')
const force = args.has('--force')
const SKIP_DATA = new Set([
  'payload_migrations',
  'payload_preferences',
  'payload_preferences_rels',
  'payload_locked_documents',
  'payload_locked_documents_rels',
  'users_sessions',
  'd1_migrations',
  ...(process.env.SYNC_EXCLUDE ?? '').split(',').filter(Boolean),
])

const wrangler = readWranglerConfig()
const dir = path.resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject')
const file = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.sqlite'))
  .map((f) => path.join(dir, f))
  .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0]
if (!file) throw new Error(`No local D1 database found in ${dir} (run the CMS locally first).`)

const db = new DatabaseSync(file, { readOnly: true })
const q = (v: unknown): string => {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number' || typeof v === 'bigint') return String(v)
  if (v instanceof Uint8Array) return `x'${Buffer.from(v).toString('hex')}'`
  return `'${String(v).replace(/'/g, "''")}'`
}

const objects = db
  .prepare("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY rowid")
  .all() as { type: string; name: string; tbl_name: string; sql: string }[]
const tables = objects.filter((o) => o.type === 'table')

const lines: string[] = ['PRAGMA defer_foreign_keys = ON;']
for (const t of tables) lines.push(`${t.sql};`)
let rowCount = 0
for (const t of tables) {
  if (SKIP_DATA.has(t.name)) continue
  const rows = db.prepare(`SELECT * FROM "${t.name}"`).all() as Record<string, unknown>[]
  for (const row of rows) {
    const cols = Object.keys(row)
    lines.push(`INSERT INTO "${t.name}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map((c) => q(row[c])).join(', ')});`)
    rowCount++
  }
}
const now = new Date().toISOString()
migrations.forEach((m, i) => {
  lines.push(`INSERT INTO "payload_migrations" ("name", "batch", "updated_at", "created_at") VALUES (${q(m.name)}, 1, ${q(now)}, ${q(now)});`)
  void i
})
for (const o of objects.filter((o) => o.type !== 'table')) lines.push(`${o.sql};`)

fs.mkdirSync('.sync', { recursive: true })
const out = path.resolve('.sync/db-dump.sql')
fs.writeFileSync(out, lines.join('\n') + '\n')
console.log(`Local database : ${file}`)
console.log(`Tables         : ${tables.length} (${rowCount} rows copied, ${migrations.length} migrations marked applied)`)
console.log(`Dump written   : ${out}`)
console.log(`Remote target  : D1 "${wrangler.d1.database_name}" (${wrangler.d1.database_id})`)

if (!execute) {
  console.log('\nDry run only. Re-run with --yes to import into the remote database above.')
  process.exit(0)
}

const run = (cmdArgs: string[]) => execFileSync('npx', ['wrangler', ...cmdArgs], { encoding: 'utf8', shell: true })
const existing = JSON.parse(
  run(['d1', 'execute', 'D1', '--remote', '--json', '--command', `"SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%'"`]),
)
const n = existing?.[0]?.results?.[0]?.n ?? 0
if (n > 0 && !force) {
  console.error(`\nRemote database already has ${n} tables. Aborting (nothing changed). Use --force only if you wiped it first.`)
  process.exit(1)
}
console.log('\nImporting into the remote database …')
console.log(run(['d1', 'execute', 'D1', '--remote', '--file', `"${out}"`, '-y']))
console.log('✓ Remote database initialised. Next: npm run sync:media -- --yes')

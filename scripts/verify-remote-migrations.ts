import { execFileSync } from 'child_process'
import path from 'path'
import { migrations } from '../src/migrations'

const target = process.argv.includes('--local') ? '--local' : '--remote'
const wrangler = path.resolve('node_modules/wrangler/bin/wrangler.js')

function query(sql: string): Record<string, unknown>[] {
  let out: string
  try {
    out = execFileSync(process.execPath, [wrangler, 'd1', 'execute', 'D1', target, '--json', '--command', sql], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    const detail = String((error as { stdout?: string }).stdout ?? error).replace(/\s+/g, ' ').slice(0, 300)
    throw new Error('Query failed: ' + sql + ' -> ' + detail)
  }
  const start = out.indexOf('[')
  if (start === -1) throw new Error(`Unexpected wrangler output:\n${out.slice(0, 400)}`)
  const parsed = JSON.parse(out.slice(start)) as { results?: Record<string, unknown>[] }[]
  return parsed[0]?.results ?? []
}

const problems: string[] = []

const applied = new Set(query('SELECT name FROM payload_migrations').map((row) => String(row.name)))
const pending = migrations.map((m) => m.name).filter((name) => !applied.has(name))
console.log(`Migrations in code: ${migrations.length}, applied on ${target.slice(2)}: ${migrations.length - pending.length}`)
if (pending.length) problems.push(`Migrations not applied: ${pending.join(', ')}`)

const count = (table: string): number => Number(query(`SELECT COUNT(*) AS n FROM ${table}`)[0]?.n ?? 0)
const counts = { page: count('page'), media: count('media'), users: count('user') }
console.log(`Content: ${counts.page} page(s), ${counts.media} media row(s), ${counts.users} admin user(s)`)
if (counts.page === 0 || counts.users === 0) {
  problems.push('The database has no pages or no admin user. Run "npm run sync:db -- --yes" and "npm run sync:media -- --yes" before deploying.')
}

if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join('\n'))
  process.exit(1)
}
console.log('✓ Schema and content are in place.')

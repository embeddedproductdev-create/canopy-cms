import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { DatabaseSync } from 'node:sqlite'
import { buildSectionCardCleanup, type Row } from '../src/migrations/20261012_120000_section_card_cleanup'
import { buildProjectContentAndCleanup } from '../src/migrations/20261013_120000_project_content_and_cleanup'
import { buildRestructure, ensureRestructureSchema } from '../src/migrations/20261014_120000_restructure_collections'
import { buildHowWeWork } from '../src/migrations/20261015_120000_how_we_work_steps'
import { buildJsonSiteSettings } from '../src/migrations/20261016_120000_json_site_settings'
import { buildVersionRepair } from '../src/utilities/versionRepair'

const base = process.argv[2] ?? 'HEAD:seed/db-dump.sql'
const target = path.resolve('seed/db-dump.sql')
const work = path.resolve('.sync/rebuild')
const dir = path.join(work, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject')

fs.rmSync(work, { recursive: true, force: true })
fs.mkdirSync(dir, { recursive: true })
const dump = base.includes(':') && !fs.existsSync(base) ? execFileSync('git', ['show', base], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }) : fs.readFileSync(base, 'utf8')

const db = new DatabaseSync(path.join(dir, 'seed.sqlite'))
db.exec(dump)
const read = async (query: string): Promise<Row[]> => db.prepare(query).all() as Row[]

const steps: { name: string; run: () => Promise<void> }[] = [
  {
    name: '20261012_120000_section_card_cleanup',
    run: async () => {
      for (const statement of await buildSectionCardCleanup(read)) db.exec(statement)
    },
  },
  {
    name: '20261013_120000_project_content_and_cleanup',
    run: async () => {
      for (const statement of (await buildProjectContentAndCleanup(read)).statements) db.exec(statement)
    },
  },
  {
    name: '20261014_120000_restructure_collections',
    run: async () => {
      for (const statement of await ensureRestructureSchema(read)) db.exec(statement)
      for (const statement of (await buildRestructure(read)).statements) db.exec(statement)
    },
  },
  {
    name: '20261015_120000_how_we_work_steps',
    run: async () => {
      for (const statement of buildHowWeWork()) db.exec(statement)
    },
  },
  {
    name: '20261016_120000_json_site_settings',
    run: async () => {
      for (const statement of await buildJsonSiteSettings(read)) db.exec(statement)
    },
  },
]

for (const step of steps) {
  if ((await read(`SELECT name FROM payload_migrations WHERE name = '${step.name}'`)).length) {
    console.log(`${step.name}: already applied in the base dump`)
    continue
  }
  await step.run()
  const now = new Date().toISOString()
  db.exec(`INSERT INTO payload_migrations (name, batch, updated_at, created_at) VALUES ('${step.name}', 1, '${now}', '${now}')`)
  console.log(`${step.name}: applied`)
}
for (const statement of await buildVersionRepair(read)) db.exec(statement)
db.close()

fs.copyFileSync(path.resolve('wrangler.jsonc'), path.join(work, 'wrangler.jsonc'))
execFileSync(process.execPath, ['--no-warnings', '--import=tsx/esm', path.resolve('scripts/sync-remote-db.ts')], {
  cwd: work,
  stdio: 'inherit',
  env: { ...process.env, SYNC_EXCLUDE: 'form_submission', NODE_OPTIONS: '--no-deprecation' },
})
fs.copyFileSync(path.join(work, '.sync/db-dump.sql'), target)
fs.rmSync(work, { recursive: true, force: true })
console.log(`Seed written to ${target}`)

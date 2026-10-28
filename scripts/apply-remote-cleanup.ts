import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { buildSectionCardCleanup, type Row } from '../src/migrations/20261012_120000_section_card_cleanup'
import { buildProjectContentAndCleanup } from '../src/migrations/20261013_120000_project_content_and_cleanup'
import { buildRestructure, ensureRestructureSchema } from '../src/migrations/20261014_120000_restructure_collections'
import { buildHowWeWork } from '../src/migrations/20261015_120000_how_we_work_steps'
import { buildJsonSiteSettings } from '../src/migrations/20261016_120000_json_site_settings'
import { buildBlogMarkdownContent } from '../src/migrations/20261028_000000_blog_markdown_content'
import { buildHeroImageFit } from '../src/migrations/20261029_000000_hero_image_fit'
import { buildSectionGroups } from '../src/migrations/20261030_000000_section_groups'
import { buildVersionRepair } from '../src/utilities/versionRepair'
import { readWranglerConfig } from './lib/wrangler-config'

type Reader = (query: string) => Promise<Row[]>

const target = process.argv.includes('--local') ? '--local' : '--remote'
const wrangler = path.resolve('node_modules/wrangler/bin/wrangler.js')

function wranglerRun(args: string[]): string {
  try {
    return execFileSync(process.execPath, [wrangler, ...args], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    const detail = String((error as { stdout?: string }).stdout ?? error).replace(/\s+/g, ' ').slice(0, 400)
    throw new Error(`wrangler failed: ${detail}`)
  }
}

const d1 = (args: string[]): string => wranglerRun(['d1', 'execute', 'D1', target, ...args])

const read: Reader = async (sql) => {
  const out = d1(['--json', '--command', sql])
  const start = out.indexOf('[')
  if (start === -1) throw new Error(`Unexpected wrangler output: ${out.slice(0, 300)}`)
  const parsed = JSON.parse(out.slice(start)) as { results?: Row[] }[]
  return parsed[0]?.results ?? []
}

const steps: { name: string; schema?: (read: Reader) => Promise<string[]>; plan: (read: Reader) => Promise<{ statements: string[]; removedMedia?: string[] }> }[] = [
  { name: '20261012_120000_section_card_cleanup', plan: async (r) => ({ statements: await buildSectionCardCleanup(r) }) },
  { name: '20261013_120000_project_content_and_cleanup', plan: buildProjectContentAndCleanup },
  { name: '20261014_120000_restructure_collections', schema: ensureRestructureSchema, plan: buildRestructure },
  { name: '20261015_120000_how_we_work_steps', plan: async () => ({ statements: buildHowWeWork() }) },
  { name: '20261016_120000_json_site_settings', plan: async (r) => ({ statements: await buildJsonSiteSettings(r) }) },
  { name: '20261028_000000_blog_markdown_content', plan: async (r) => ({ statements: await buildBlogMarkdownContent(r) }) },
  { name: '20261029_000000_hero_image_fit', plan: async (r) => ({ statements: await buildHeroImageFit(r) }) },
  { name: '20261030_000000_section_groups', plan: async (r) => ({ statements: await buildSectionGroups(r) }) },
]

for (const step of steps) {
  const applied = await read(`SELECT "name" FROM "payload_migrations" WHERE "name" = '${step.name}'`)
  if (applied.length) {
    console.log(`${step.name} is already applied on ${target.slice(2)}.`)
    continue
  }

  if (step.schema) {
    const ddl = await step.schema(read)
    if (ddl.length) {
      fs.mkdirSync('.sync', { recursive: true })
      const schemaFile = path.resolve('.sync/schema.sql')
      fs.writeFileSync(schemaFile, ddl.map((statement) => `${statement};`).join('\n') + '\n')
      console.log(`${step.name}: ${ddl.length} schema statements`)
      d1(['--file', schemaFile, '-y'])
    }
  }

  const plan = await step.plan(read)
  const batch = Number((await read(`SELECT coalesce(max("batch"), 0) AS n FROM "payload_migrations"`))[0]?.n ?? 0)
  const now = new Date().toISOString()
  const statements = [
    ...plan.statements,
    `INSERT INTO "payload_migrations" ("name", "batch", "updated_at", "created_at") VALUES ('${step.name}', ${batch + 1}, '${now}', '${now}')`,
  ]

  fs.mkdirSync('.sync', { recursive: true })
  const file = path.resolve('.sync/cleanup.sql')
  fs.writeFileSync(file, statements.map((statement) => `${statement};`).join('\n') + '\n')
  console.log(`${step.name}: ${statements.length} statements -> ${target.slice(2)} database`)
  d1(['--file', file, '-y'])

  const removed = plan.removedMedia ?? []
  if (removed.length) {
    console.log(`Removed ${removed.length} unused media rows: ${removed.join(', ')}`)
    if (target === '--remote') {
      const { r2 } = readWranglerConfig()
      for (const filename of removed) {
        try {
          wranglerRun(['r2', 'object', 'delete', `${r2.bucket_name}/${filename}`, '--remote'])
          console.log(`  R2: deleted ${filename}`)
        } catch (error) {
          console.warn(`  R2: could not delete ${filename}: ${(error as Error).message}`)
        }
      }
    }
  }
  console.log(`${step.name} applied.`)
}
const repair = await buildVersionRepair(read)
if (repair.length) {
  fs.mkdirSync('.sync', { recursive: true })
  const file = path.resolve('.sync/versions.sql')
  fs.writeFileSync(file, repair.map((statement) => `${statement};`).join('\n') + '\n')
  console.log(`Rebuilding missing draft versions: ${repair.length} statements`)
  d1(['--file', file, '-y'])
} else {
  console.log('Draft versions are complete.')
}
process.exit(0)

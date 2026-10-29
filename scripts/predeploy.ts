import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'

// Run before every CMS deploy (`npm run predeploy`). It repeats, locally, the checks the deploy workflow makes plus
// the ones that have caused failed deploys before (see CLAUDE.md), so a problem shows up here and not in GitHub Actions.
const generated = [
  { file: 'src/app/(payload)/admin/importMap.js', command: 'npm run generate:importmap' },
  { file: 'src/payload-types.ts', command: 'npm run generate:types:payload' },
  { file: 'CMS-GUIDE.md', command: 'npm run docs:cms' },
  { file: 'CONTENT-MAP.md', command: 'npm run docs:content' },
  { file: 'scripts/lib/expected-schema.json', command: 'npm run schema:expected' },
]
const sourceRoots = ['src/', 'scripts/', 'tests/', 'docs/', '.github/', 'seed/db-dump.sql', 'package.json', 'wrangler.jsonc', 'next.config.ts', 'open-next.config.ts']

type Result = { step: string; ok: boolean; note?: string }
const results: Result[] = []

function run(step: string, command: string, notes?: string): boolean {
  console.log(`\n▶ ${step}\n  $ ${command}`)
  const done = spawnSync(command, { shell: true, stdio: 'inherit' })
  const ok = done.status === 0
  results.push({ step, ok, note: ok ? undefined : (notes ?? `exit ${done.status}`) })
  return ok
}

const read = (file: string): string => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '')

function finish(): never {
  console.log('\n──────── predeploy summary ────────')
  for (const { step, ok, note } of results) console.log(`${ok ? '✓' : '✗'} ${step}${note ? `  (${note})` : ''}`)
  const failed = results.filter((result) => !result.ok)
  console.log(failed.length ? `\n${failed.length} check(s) failed. Fix them before deploying.` : '\nAll checks passed. This does not cover the steps that need Cloudflare credentials (see CLAUDE.md).')
  process.exit(failed.length ? 1 : 0)
}

if (!run('Type-check', 'npx tsc --noEmit')) finish()
if (!run('Integration tests', 'npx vitest run --config ./vitest.config.mts')) finish()

// A generated file that changes when regenerated was stale: the workflow would fail its "up to date" check.
for (const { file, command } of generated) {
  const before = read(file)
  if (!run(`Regenerate ${file}`, command)) continue
  if (read(file) !== before) {
    results.push({ step: `${file} is up to date`, ok: false, note: 'it was stale and has been regenerated; commit the new version' })
  }
}

const dbReady = fs.existsSync(path.resolve('.wrangler/state/v3/d1'))
if (dbReady) run('Local database matches the code (verify:remote --local)', 'npm run verify:remote -- --local')
else results.push({ step: 'Local database check', ok: true, note: 'skipped: no local database yet (npm run seed:local)' })

// The workflow builds from GitHub, so a new file that was never committed makes CI fail with "Cannot find module".
const untracked = spawnSync('git ls-files --others --exclude-standard', { shell: true, encoding: 'utf8' }).stdout.split('\n').filter((line) => line && sourceRoots.some((root) => line.startsWith(root)))
if (untracked.length) {
  console.log(`\n⚠ Not in git yet (commit and push them, the workflow builds from GitHub):\n${untracked.map((line) => `  ${line}`).join('\n')}`)
  results.push({ step: 'New files are committed', ok: true, note: `${untracked.length} file(s) still untracked; add them before pushing` })
}

finish()

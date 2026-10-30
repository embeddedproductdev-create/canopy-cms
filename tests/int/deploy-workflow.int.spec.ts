import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const workflow = fs.readFileSync(path.resolve(__dirname, '../../.github/workflows/deploy-cms.yml'), 'utf8')

describe('deploy-cms workflow', () => {
  it('tells the user to re-run with upload_media when media is missing from R2', () => {
    const line = workflow.split('\n').find((l) => l.includes('Media is not served from R2'))
    expect(line).toBeDefined()
    expect(line).toContain('upload_media')
  })

  it('does not replace the live database unless asked to, and asks twice', () => {
    expect(workflow).toMatch(/replace_database:[\s\S]*?default: false/)
    expect(workflow).toMatch(/confirm_replace:/)
    const guard = workflow.split('\n').find((l) => l.includes("'REPLACE'"))
    expect(guard).toBeDefined()
  })

  it('backs the live database up as an artifact before replacing it', () => {
    const backup = workflow.indexOf('wrangler d1 export')
    const upload = workflow.indexOf('actions/upload-artifact')
    const replace = workflow.indexOf('npm run replace:db')
    expect(backup).toBeGreaterThan(-1)
    expect(upload).toBeGreaterThan(backup)
    expect(replace).toBeGreaterThan(upload)
  })

  it('lets the data-loss guard be overridden only on purpose', () => {
    expect(workflow).toMatch(/allow_data_loss:/)
    expect(workflow).toContain('--allow-data-loss')
  })
})

describe('repair-cms workflow (database fix only, no redeploy)', () => {
  const file = path.resolve(__dirname, '../../.github/workflows/repair-cms.yml')
  const repair = () => fs.readFileSync(file, 'utf8')

  it('exists and only runs when started by hand', () => {
    expect(fs.existsSync(file)).toBe(true)
    expect(repair()).toMatch(/on:\s*\n\s*workflow_dispatch:/)
    expect(repair()).not.toMatch(/\bpush:|\bschedule:/)
  })

  it('backs the database up, applies pending migrations, verifies them, then checks every image', () => {
    const text = repair()
    const order = ['wrangler d1 export', 'npm run apply:cleanup', 'npm run verify:remote', 'npm run check:media']
    const at = order.map((step) => text.indexOf(step))
    expect(at.every((index) => index > -1)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('never redeploys the Worker or replaces content', () => {
    const text = repair()
    expect(text).not.toContain('wrangler deploy')
    expect(text).not.toContain('replace:db')
    expect(text).not.toContain('build:cf')
  })
})

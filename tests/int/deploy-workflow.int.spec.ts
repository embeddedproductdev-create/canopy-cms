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

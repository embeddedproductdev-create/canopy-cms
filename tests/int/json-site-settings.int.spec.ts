import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { buildJsonSiteSettings, type Row } from '../../src/migrations/20261016_120000_json_site_settings'
import { navItemsField, socialLinksField, linkGroupsField, disallowPathsField, uiLabelsField } from '../../src/globals/jsonFields'

const all = (sqlite: DatabaseSync, query: string) => sqlite.prepare(query).all() as Row[]
const json = (sqlite: DatabaseSync, query: string) => JSON.parse(String(all(sqlite, query)[0].v))
type Validate = (value: unknown) => string | true
const check = (field: unknown, value: unknown) => (field as { validate: Validate }).validate(value)

describe('JSON site settings', () => {
  it('stores the committed seed as JSON in the same shape the website reads', () => {
    const sqlite = new DatabaseSync(':memory:')
    sqlite.exec(fs.readFileSync(path.resolve('seed/db-dump.sql'), 'utf8'))
    const nav = json(sqlite, 'SELECT nav_items AS v FROM header')
    expect(nav.length).toBeGreaterThan(0)
    expect(check(navItemsField, nav)).toBe(true)
    expect(nav.some((item: { children?: unknown[] }) => (item.children ?? []).length > 0)).toBe(true)
    expect(check(linkGroupsField, json(sqlite, 'SELECT link_groups AS v FROM footer'))).toBe(true)
    expect(check(socialLinksField, json(sqlite, 'SELECT social_links AS v FROM footer'))).toBe(true)
    const paths = json(sqlite, 'SELECT disallow_paths AS v FROM seo_settings')
    expect(check(disallowPathsField, paths)).toBe(true)
    const labels = json(sqlite, 'SELECT ui_labels AS v FROM site_chrome')
    expect(Object.keys(labels).length).toBeGreaterThan(100)
    expect(check(uiLabelsField, labels)).toBe(true)
    for (const table of ['header_nav_items', 'footer_link_groups', 'seo_settings_disallow_paths', 'site_chrome_ui_labels']) {
      expect(all(sqlite, `SELECT count(*) AS n FROM ${table}`)[0].n, table).toBe(0)
    }
  })

  it('converts the repeating rows of the previous seed without losing anything and never overwrites later edits', async () => {
    let dump: string
    try {
      dump = execFileSync('git', ['show', 'HEAD:seed/db-dump.sql'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
    } catch {
      return
    }
    const sqlite = new DatabaseSync(':memory:')
    sqlite.exec(dump)
    if (all(sqlite, "SELECT name FROM pragma_table_info('header') WHERE name = 'nav_items'").length) return
    const rows = Number(all(sqlite, 'SELECT count(*) AS n FROM site_chrome_ui_labels')[0].n)
    const read = async (query: string) => all(sqlite, query)
    for (const statement of await buildJsonSiteSettings(read)) sqlite.exec(statement)
    expect(Object.keys(json(sqlite, 'SELECT ui_labels AS v FROM site_chrome'))).toHaveLength(rows)
    expect(json(sqlite, 'SELECT nav_items AS v FROM header')[0]).toHaveProperty('label')

    sqlite.exec(`UPDATE header SET nav_items = '[{"label":"Edited","url":"/x/"}]'`)
    for (const statement of await buildJsonSiteSettings(read)) sqlite.exec(statement)
    expect(json(sqlite, 'SELECT nav_items AS v FROM header')).toEqual([{ label: 'Edited', url: '/x/' }])
  })

  it('rejects malformed JSON with a readable message', () => {
    expect(check(navItemsField, [{ label: 'Work' }])).toContain('"url"')
    expect(check(socialLinksField, [{ label: 'X', href: 'https://x.test', icon: 'tiktok' }])).toContain('icon')
    expect(check(disallowPathsField, ['admin'])).toContain('start with /')
    expect(check(uiLabelsField, { a: 1 })).toContain('text values')
  })
})

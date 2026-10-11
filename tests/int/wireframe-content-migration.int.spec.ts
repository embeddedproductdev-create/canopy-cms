import { DatabaseSync } from 'node:sqlite'
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { describe, expect, it } from 'vitest'
import { up } from '../../src/migrations/20261009_120000_wireframe_content_model'
import { normalizeUrlValue } from '../../src/hooks/normalizeUrl'
import { shouldRedact } from '../../src/hooks/redactLockedChecklist'

const dialect = new SQLiteSyncDialect()

function makeDb(sqlite: DatabaseSync) {
  type Params = (string | number | bigint | Uint8Array | null)[]
  return {
    all: async (query: Parameters<typeof dialect.sqlToQuery>[0]) => {
      const compiled = dialect.sqlToQuery(query)
      return sqlite.prepare(compiled.sql).all(...(compiled.params as Params))
    },
    run: async (query: Parameters<typeof dialect.sqlToQuery>[0]) => {
      const compiled = dialect.sqlToQuery(query)
      return sqlite.prepare(compiled.sql).run(...(compiled.params as Params))
    },
  }
}

describe('wireframe content model migration', () => {
  it('adds section/page columns and new tables without touching existing rows, and is idempotent', async () => {
    const sqlite = new DatabaseSync(':memory:')
    sqlite.exec(`
      CREATE TABLE section (id INTEGER PRIMARY KEY, title TEXT);
      CREATE TABLE page (id INTEGER PRIMARY KEY, title TEXT);
      CREATE TABLE _page_v (id INTEGER PRIMARY KEY);
      CREATE TABLE blog (id INTEGER PRIMARY KEY);
      CREATE TABLE _blog_v (id INTEGER PRIMARY KEY);
      CREATE TABLE case_study (id INTEGER PRIMARY KEY);
      CREATE TABLE _case_study_v (id INTEGER PRIMARY KEY);
      CREATE TABLE header (id INTEGER PRIMARY KEY);
      CREATE TABLE header_nav_items (_order INTEGER, _parent_id INTEGER, id TEXT PRIMARY KEY, label TEXT, url TEXT);
      CREATE TABLE site_chrome (id INTEGER PRIMARY KEY);
      CREATE TABLE checklist (id INTEGER PRIMARY KEY);
      CREATE TABLE _checklist_v (id INTEGER PRIMARY KEY);
      CREATE TABLE payload_locked_documents_rels (id INTEGER PRIMARY KEY);
      INSERT INTO section (id, title) VALUES (1, 'Existing section');
      INSERT INTO page (id, title) VALUES (1, 'Existing page');
      INSERT INTO header (id) VALUES (1);
      INSERT INTO header_nav_items VALUES (0, 1, 'nav1', 'Capabilities', '/capabilities/');
    `)
    const db = makeDb(sqlite)

    await up({ db } as never)
    await up({ db } as never)

    const sectionColumns = sqlite.prepare('PRAGMA table_info("section")').all() as { name: string }[]
    expect(sectionColumns.map((c) => c.name)).toEqual(
      expect.arrayContaining(['variant', 'columns', 'anchor', 'tags', 'hidden']),
    )
    expect(sqlite.prepare('SELECT title, hidden FROM section WHERE id = 1').get()).toEqual({
      title: 'Existing section',
      hidden: 0,
    })
    const pageColumns = sqlite.prepare('PRAGMA table_info("page")').all() as { name: string }[]
    expect(pageColumns.map((c) => c.name)).toEqual(expect.arrayContaining(['eyebrow', 'page_type']))

    for (const table of [
      'blog_rels',
      '_blog_v_rels',
      'case_study_rels',
      '_case_study_v_rels',
      'header_nav_items_children',
      'site_chrome_ui_labels',
      'form_submission',
    ]) {
      expect(
        sqlite.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`).get(table),
      ).toEqual({ name: table })
    }

    const blogColumns = sqlite.prepare('PRAGMA table_info("blog")').all() as { name: string }[]
    expect(blogColumns.map((c) => c.name)).toContain('featured')
    const checklistColumns = sqlite.prepare('PRAGMA table_info("checklist")').all() as { name: string }[]
    expect(checklistColumns.map((c) => c.name)).toContain('access_gate_form_anchor')
    sqlite.exec(`INSERT INTO form_submission (form, email) VALUES ('engagement', 'a@b.co')`)
    expect(sqlite.prepare('SELECT status FROM form_submission').get()).toEqual({ status: 'new' })

    sqlite.exec(`INSERT INTO header_nav_items_children VALUES (0, 'nav1', 'c1', 'Hardware', '/capabilities/pcb-design/', 'PCB')`)
    expect(sqlite.prepare('SELECT label FROM header_nav_items_children').get()).toEqual({ label: 'Hardware' })
    sqlite.close()
  })
})

describe('normalizeUrlValue', () => {
  it.each([
    ['https://example.com/a', 'https://example.com/a'],
    ['/capabilities/firmware/', '/capabilities/firmware/'],
    ['#form', '#form'],
    ['mailto:a@b.co', 'mailto:a@b.co'],
    ['contact@canopyembedded.com', 'mailto:contact@canopyembedded.com'],
    ['+91 98765 43210', 'tel:+919876543210'],
    ['www.canopyembedded.com', 'https://www.canopyembedded.com'],
    ['  /about/  ', '/about/'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeUrlValue(input)).toBe(expected)
  })
})

describe('locked checklist items', () => {
  it('are redacted for anonymous readers only', () => {
    expect(shouldRedact({ locked: true }, false)).toBe(true)
    expect(shouldRedact({ locked: true }, true)).toBe(false)
    expect(shouldRedact({ locked: false }, false)).toBe(false)
    expect(shouldRedact(undefined, false)).toBe(false)
  })
})

import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { buildSectionCardCleanup, type Row } from '../../src/migrations/20261012_120000_section_card_cleanup'

function seedDatabase(): DatabaseSync {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(fs.readFileSync(path.resolve('seed/db-dump.sql'), 'utf8'))
  return sqlite
}

async function migrate(sqlite: DatabaseSync): Promise<string[]> {
  const statements = await buildSectionCardCleanup(async (query) => sqlite.prepare(query).all() as Row[])
  for (const statement of statements) sqlite.exec(statement)
  return statements
}

const all = (sqlite: DatabaseSync, query: string) => sqlite.prepare(query).all() as Row[]

describe('section and card cleanup migration', () => {
  it('cleans titles, notes, copy stored in tags and separators, and is idempotent', async () => {
    const sqlite = seedDatabase()
    await migrate(sqlite)

    expect(all(sqlite, `SELECT id FROM section WHERE title LIKE '%·%'`)).toHaveLength(0)
    expect(all(sqlite, `SELECT title FROM section WHERE id = 152`)[0].title).toBe('Work - Closing')
    expect(all(sqlite, `SELECT title FROM section WHERE id = 102`)[0].title).toBe('Home - Hero')
    expect(all(sqlite, `SELECT id FROM section WHERE section_key = 'spec-fields-needed'`)).toHaveLength(0)
    expect(all(sqlite, `SELECT id FROM section WHERE section_key = 'specs-note' AND subheading IS NOT NULL`)).toHaveLength(0)

    expect(all(sqlite, `SELECT heading FROM section WHERE section_key = 'ideate'`)[0].heading).toBe('Ideate. Innovate. **Launch.**')
    expect(all(sqlite, `SELECT tags FROM section WHERE section_key = 'included'`)[0].tags).toBe('Discipline, Included')

    const form = all(sqlite, `SELECT body FROM section WHERE type = 'form'`)[0]
    expect(String(form.body)).toContain('NDA signed before the scoping call')
    expect(String(form.body)).toContain('No spam. A real person on our team follows up personally.')

    const steps = all(sqlite, `SELECT title, tags, description FROM card WHERE title IN ('Discover & Scope', 'Design & Build', 'Validate & Deploy')`)
    expect(steps).toHaveLength(3)
    for (const step of steps) {
      expect(step.tags).toBeNull()
      const items = JSON.parse(String(step.description)).root.children[0].children
      expect(items.length).toBeGreaterThanOrEqual(3)
    }

    expect(all(sqlite, `SELECT id FROM card WHERE short_description LIKE '[ One-line bio%'`)).toHaveLength(0)
    expect(all(sqlite, `SELECT subheading FROM card WHERE title = 'Firmware Engineering'`)[0].subheading).toContain('RTOS and OTA')
    expect(all(sqlite, `SELECT subheading FROM card WHERE title = 'Srini'`)[0].subheading).toBe('Co-founder & CTO')
    expect(all(sqlite, `SELECT value FROM card WHERE title = 'Work Email'`)[0].value).toBe('email')

    expect(String(all(sqlite, `SELECT subheading FROM case_study WHERE slug = 'smart-bms'`)[0].subheading).length).toBeGreaterThan(20)
    expect(all(sqlite, `SELECT category FROM blog WHERE category LIKE '%·%'`)).toHaveLength(0)
    expect(all(sqlite, `SELECT sub_heading FROM footer`)[0].sub_heading).toBe('Electronics product development - Chennai, India')
    expect(all(sqlite, `SELECT value FROM site_chrome_ui_labels WHERE key = 'checklist.gate.emailPlaceholder'`)[0].value).toBe('you@company.com')

    const snapshot = JSON.stringify([
      all(sqlite, 'SELECT * FROM section ORDER BY id'),
      all(sqlite, 'SELECT * FROM card ORDER BY id'),
      all(sqlite, 'SELECT * FROM case_study ORDER BY id'),
    ])
    const again = await migrate(sqlite)
    expect(again.filter((statement) => statement.startsWith('DELETE') || statement.includes('"title" ='))).toHaveLength(0)
    expect(
      JSON.stringify([
        all(sqlite, 'SELECT * FROM section ORDER BY id'),
        all(sqlite, 'SELECT * FROM card ORDER BY id'),
        all(sqlite, 'SELECT * FROM case_study ORDER BY id'),
      ]),
    ).toBe(snapshot)
  })
})

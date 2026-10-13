import { describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import fs from 'fs'
import path from 'path'
import { buildHowWeWork, howWeWork } from '../../src/migrations/20261015_120000_how_we_work_steps'

describe('How We Work cards', () => {
  it('writes the three bullet lists on the home steps cards (seed and migration)', () => {
    const db = new DatabaseSync(':memory:')
    db.exec(fs.readFileSync(path.resolve('seed/db-dump.sql'), 'utf8'))
    for (const [title, items] of Object.entries(howWeWork)) {
      const rows = db.prepare('SELECT description FROM card WHERE title = ?').all(title) as { description: string }[]
      expect(rows).toHaveLength(1)
      const list = JSON.parse(rows[0].description).root.children[0].children.map((li: { children: { text: string }[] }) => li.children[0].text)
      expect(list).toEqual(items)
    }
    expect(buildHowWeWork()).toHaveLength(3)
  })
})

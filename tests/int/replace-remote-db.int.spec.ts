import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { buildReplaceSql, dropOrder, type FkEdge, type Row } from '../../scripts/lib/replace-sql'

const seed = fs.readFileSync(path.resolve('seed/db-dump.sql'), 'utf8')

function oldRemote(): DatabaseSync | null {
  try {
    const dump = execFileSync('git', ['show', 'b3d541c:seed/db-dump.sql'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
    const db = new DatabaseSync(':memory:')
    db.exec(dump)
    return db
  } catch {
    return null
  }
}

describe('replace remote database', () => {
  it('drops children before parents', () => {
    const edges: FkEdge[] = [{ child: 'b', parent: 'a' }, { child: 'c', parent: 'b' }, { child: 'a', parent: 'a' }]
    expect(dropOrder(['a', 'b', 'c'], edges)).toEqual(['c', 'b', 'a'])
  })

  it('replaces an older remote schema with the seed while keeping users, with foreign keys enforced', (ctx) => {
    const db = oldRemote()
    if (!db) ctx.skip()
    const remote = db!
    const all = (query: string) => remote.prepare(query).all() as Row[]
    const tables = all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").map((row) => String(row.name))
    const edges = all("SELECT m.name AS child, f.\"table\" AS parent FROM sqlite_master m, pragma_foreign_key_list(m.name) f WHERE m.type = 'table'").map((row) => ({ child: String(row.child), parent: String(row.parent) }))
    const kept = { user: all('SELECT * FROM "user"'), form_submission: all('SELECT * FROM form_submission') }
    expect(kept.user.length).toBeGreaterThan(0)

    remote.exec('PRAGMA foreign_keys = ON')
    remote.exec(buildReplaceSql(tables, edges, kept, seed))

    const fresh = new DatabaseSync(':memory:')
    fresh.exec(seed)
    for (const table of ['page', 'section', 'card', 'capability', 'industry', 'case_study', 'blog', 'checklist', 'media']) {
      expect(all(`SELECT count(*) AS n FROM ${table}`)[0].n, table).toEqual((fresh.prepare(`SELECT count(*) AS n FROM ${table}`).all() as Row[])[0].n)
    }
    expect(all('SELECT email FROM "user"').map((row) => row.email)).toEqual(kept.user.map((row) => row.email))
    expect(all('PRAGMA foreign_key_check')).toHaveLength(0)
  })
})

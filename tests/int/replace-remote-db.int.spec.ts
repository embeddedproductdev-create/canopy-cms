import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { buildReplaceChunks, buildReplaceSql, countStatements, dataLossReport, dropOrder, expectedRowCounts, splitStatements, type FkEdge, type Row } from '../../scripts/lib/replace-sql'
import { isTransientD1Error, runWithRetry } from '../../scripts/lib/retry'

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

/** A copy of the seed schema and data, with one admin user the replacement must keep. */
function remoteFromSeed(): { db: DatabaseSync; tables: string[]; edges: FkEdge[]; kept: Record<string, Row[]> } {
  const db = new DatabaseSync(':memory:')
  db.exec(seed)
  const all = (query: string) => db.prepare(query).all() as Row[]
  db.exec("UPDATE \"user\" SET email = 'keep@example.com' WHERE id = (SELECT min(id) FROM \"user\")")
  const tables = all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").map((row) => String(row.name))
  const edges = all("SELECT m.name AS child, f.\"table\" AS parent FROM sqlite_master m, pragma_foreign_key_list(m.name) f WHERE m.type = 'table'").map((row) => ({ child: String(row.child), parent: String(row.parent) }))
  const kept = { user: all('SELECT * FROM "user"') }
  return { db, tables, edges, kept }
}

const snapshot = (db: DatabaseSync): Record<string, string[]> => {
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as Row[]).map((row) => String(row.name))
  return Object.fromEntries(tables.map((table) => [table, (db.prepare(`SELECT * FROM "${table}"`).all() as Row[]).map((row) => JSON.stringify(row)).sort()]))
}

/** D1 runs each imported file as one transaction, which is what lets foreign keys be deferred inside it. */
const runFile = (db: DatabaseSync, sql: string) => {
  db.exec('BEGIN')
  try {
    db.exec(sql)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

describe('replace remote database in chunks', () => {
  it('splits statements without breaking quoted values', () => {
    const sql = "INSERT INTO \"t\" VALUES ('it''s; fine');\nINSERT INTO \"t\" VALUES ('line one;\nline two');\nCREATE TABLE `u` (`a` text DEFAULT ';');"
    expect(splitStatements(sql)).toEqual([
      "INSERT INTO \"t\" VALUES ('it''s; fine')",
      "INSERT INTO \"t\" VALUES ('line one;\nline two')",
      "CREATE TABLE `u` (`a` text DEFAULT ';')",
    ])
  })

  it('produces the same database as the single-file replacement, one small transaction at a time', () => {
    const single = remoteFromSeed()
    single.db.exec('PRAGMA foreign_keys = ON')
    runFile(single.db, buildReplaceSql(single.tables, single.edges, single.kept, seed))

    const chunked = remoteFromSeed()
    chunked.db.exec('PRAGMA foreign_keys = ON')
    const chunks = buildReplaceChunks(chunked.tables, chunked.edges, chunked.kept, seed, 20_000)
    expect(chunks.length).toBeGreaterThan(3)
    for (const chunk of chunks) {
      runFile(chunked.db, chunk)
      expect(chunked.db.prepare('PRAGMA foreign_key_check').all(), 'foreign keys after a chunk').toHaveLength(0)
    }
    expect(snapshot(chunked.db)).toEqual(snapshot(single.db))
    expect((chunked.db.prepare('SELECT email FROM "user"').all() as Row[]).map((row) => row.email)).toEqual(['keep@example.com'])
  })

  it('keeps rows that have columns added by later migrations when the deploy is run again', () => {
    const { db, tables, edges, kept } = remoteFromSeed()
    // What a live database looks like after one deploy: migrations added columns the seed's tables do not have.
    db.exec('ALTER TABLE "user" ADD COLUMN "reset_password_requested_at" text')
    db.exec('ALTER TABLE form_submission ADD COLUMN phone text')
    db.exec("UPDATE \"user\" SET reset_password_requested_at = '2026-10-29T00:00:00.000Z' WHERE id = (SELECT min(id) FROM \"user\")")
    db.exec("INSERT INTO form_submission (form, email, phone) VALUES ('consultation', 'lead@example.com', '+91 98765 43210')")
    const all = (query: string) => db.prepare(query).all() as Row[]
    const liveKept = { user: all('SELECT * FROM "user"'), form_submission: all('SELECT * FROM form_submission') }
    const keptSchema = Object.fromEntries(
      ['user', 'form_submission'].map((table) => [table, all(`SELECT name, type FROM pragma_table_info('${table}')`) as { name: string; type: string }[]]),
    )

    db.exec('PRAGMA foreign_keys = ON')
    for (const chunk of buildReplaceChunks(tables, edges, liveKept, seed, 20_000, keptSchema)) runFile(db, chunk)

    expect(all('SELECT reset_password_requested_at AS v FROM "user" LIMIT 1')[0].v).toBe('2026-10-29T00:00:00.000Z')
    expect(all("SELECT phone FROM form_submission WHERE email = 'lead@example.com'")[0].phone).toBe('+91 98765 43210')
    expect(all('PRAGMA foreign_key_check')).toHaveLength(0)
    expect(kept.user.length).toBeGreaterThan(0)
  })

  it('keeps every chunk small and puts structure and kept rows in the first one', () => {
    const { tables, edges, kept } = remoteFromSeed()
    const max = 20_000
    const chunks = buildReplaceChunks(tables, edges, kept, seed, max)
    expect(chunks[0]).toContain('DROP TABLE')
    expect(chunks[0]).toContain('CREATE TABLE')
    expect(chunks[0]).toContain('keep@example.com')
    for (const chunk of chunks.slice(1)) {
      expect(chunk).not.toContain('CREATE TABLE')
      expect(chunk.length).toBeLessThanOrEqual(max + 12_000)
    }
  })

  it('counts the rows the seed should leave in each table', () => {
    const counts = expectedRowCounts(seed)
    expect(counts.card).toBe(292)
    expect(counts.section_rels).toBe(289)
  })

  it('counts rows with one simple SELECT per table, never a compound SELECT (D1 allows only a few terms)', () => {
    const statements = countStatements(['card', 'section_rels'])
    expect(statements).toEqual([
      `SELECT 'card' AS t, count(*) AS n FROM "card"`,
      `SELECT 'section_rels' AS t, count(*) AS n FROM "section_rels"`,
    ])
    expect(statements.join(' ')).not.toMatch(/UNION/i)
  })

  it('retries only transient D1 failures', async () => {
    expect(isTransientD1Error('✘ [ERROR] {"D1_RESET_DO":true}')).toBe(true)
    expect(isTransientD1Error('Network connection lost')).toBe(true)
    expect(isTransientD1Error('SQLITE_ERROR: no such table')).toBe(false)

    let calls = 0
    const waits: number[] = []
    const result = await runWithRetry(
      () => {
        calls += 1
        if (calls < 3) throw new Error('wrangler failed {"D1_RESET_DO":true}')
        return 'ok'
      },
      { delays: [5, 15], sleep: async (ms) => void waits.push(ms) },
    )
    expect(result).toBe('ok')
    expect(calls).toBe(3)
    expect(waits).toEqual([5, 15])

    let hard = 0
    await expect(
      runWithRetry(
        () => {
          hard += 1
          throw new Error('SQLITE_ERROR: syntax error')
        },
        { delays: [5, 15], sleep: async () => {} },
      ),
    ).rejects.toThrow('syntax error')
    expect(hard).toBe(1)
  })
})

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

describe('data-loss guard', () => {
  const seedSql = `INSERT INTO "blog" ("id") VALUES (1);\nINSERT INTO "media" ("id") VALUES (1);\nINSERT INTO "media" ("id") VALUES (2);\n`

  it('reports every content table where the seed has fewer rows than the live database', () => {
    const problems = dataLossReport({ blog: 10, media: 2, case_study: 3 }, expectedRowCounts(seedSql))
    expect(problems).toEqual(['blog: live has 10, the seed has 1', 'case_study: live has 3, the seed has 0'])
  })

  it('is quiet when the seed has at least as many rows', () => {
    expect(dataLossReport({ blog: 1, media: 1 }, expectedRowCounts(seedSql))).toEqual([])
  })

  it('ignores tables that are not content', () => {
    expect(dataLossReport({ payload_migrations: 20, user: 3 }, expectedRowCounts(seedSql))).toEqual([])
  })
})

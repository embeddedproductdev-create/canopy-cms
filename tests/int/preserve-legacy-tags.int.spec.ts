import { DatabaseSync } from 'node:sqlite'
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { describe, expect, it } from 'vitest'
import { up } from '../../src/migrations/20261002_001700_preserve_legacy_tags'

const dialect = new SQLiteSyncDialect()

describe('preserving legacy tags', () => {
  it('copies ordered tags into the text fields and leaves legacy data in place', async () => {
    const sqlite = new DatabaseSync(':memory:')
    sqlite.exec(`
      CREATE TABLE card (id INTEGER PRIMARY KEY, tags TEXT);
      CREATE TABLE blog (id INTEGER PRIMARY KEY);
      CREATE TABLE _blog_v (id INTEGER PRIMARY KEY);
      CREATE TABLE case_study (id INTEGER PRIMARY KEY);
      CREATE TABLE _case_study_v (id INTEGER PRIMARY KEY);
      CREATE TABLE card_tags (_order INTEGER, _parent_id INTEGER, id TEXT, tag TEXT);
      CREATE TABLE blog_tags (_order INTEGER, _parent_id INTEGER, id TEXT, tag TEXT);
      CREATE TABLE _blog_v_version_tags (_order INTEGER, _parent_id INTEGER, id TEXT, tag TEXT);
      CREATE TABLE case_study_features (_order INTEGER, _parent_id INTEGER, id TEXT, feature TEXT);
      INSERT INTO card (id) VALUES (1);
      INSERT INTO blog (id) VALUES (2);
      INSERT INTO _blog_v (id) VALUES (3);
      INSERT INTO case_study (id) VALUES (4);
      INSERT INTO _case_study_v (id) VALUES (5);
      INSERT INTO card_tags VALUES (1, 1, 'c2', 'Firmware'), (0, 1, 'c1', 'Hardware');
      INSERT INTO blog_tags VALUES (0, 2, 'b1', 'IoT');
      INSERT INTO _blog_v_version_tags VALUES (0, 3, 'v1', 'Draft tag');
      INSERT INTO case_study_features VALUES (0, 4, 'f1', 'Preserved feature');
    `)

    const db = {
      all: async (query: Parameters<typeof dialect.sqlToQuery>[0]) => {
        const compiled = dialect.sqlToQuery(query)
        return sqlite
          .prepare(compiled.sql)
          .all(...(compiled.params as (string | number | bigint | Uint8Array | null)[]))
      },
      run: async (query: Parameters<typeof dialect.sqlToQuery>[0]) => {
        const compiled = dialect.sqlToQuery(query)
        return sqlite
          .prepare(compiled.sql)
          .run(...(compiled.params as (string | number | bigint | Uint8Array | null)[]))
      },
    }

    await up({ db } as never)

    expect(sqlite.prepare('SELECT tags FROM card WHERE id = 1').get()).toEqual({
      tags: 'Hardware, Firmware',
    })
    expect(sqlite.prepare('SELECT tags FROM blog WHERE id = 2').get()).toEqual({ tags: 'IoT' })
    expect(sqlite.prepare('SELECT tags FROM _blog_v WHERE id = 3').get()).toEqual({
      tags: 'Draft tag',
    })
    expect(
      sqlite.prepare('SELECT feature FROM case_study_features WHERE _parent_id = 4').get(),
    ).toEqual({ feature: 'Preserved feature' })

    sqlite.close()
  })
})

import { DatabaseSync } from 'node:sqlite'
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { describe, expect, it } from 'vitest'
import { up } from '../../src/migrations/20260930_193000_typed_content_model'

const dialect = new SQLiteSyncDialect()

function createMigrationDatabase(includeLegacyFooter = true, includeFooterCopyright = true) {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(`
    CREATE TABLE page (id INTEGER PRIMARY KEY, constant TEXT);
    CREATE TABLE section (
      id INTEGER PRIMARY KEY,
      title TEXT,
      heading TEXT,
      subheading TEXT,
      body TEXT,
      image_id INTEGER,
      content TEXT,
      constant TEXT
    );
    CREATE TABLE media (id INTEGER PRIMARY KEY);
    INSERT INTO media (id) VALUES (42);
    CREATE TABLE card (id INTEGER PRIMARY KEY, title TEXT, image_id INTEGER);
    CREATE TABLE header (id INTEGER PRIMARY KEY, nav_items TEXT, nav_cta_label TEXT, nav_cta_url TEXT);
    CREATE TABLE footer (id INTEGER PRIMARY KEY${includeLegacyFooter ? ', content TEXT' : ''});
    INSERT INTO page (id, constant) VALUES (1, '{"heading":"Legacy page heading"}');
    INSERT INTO section (id, title, content, constant) VALUES (
      7,
      'Capability',
      '{"id":"capability-detail","heading":"Typed heading","imageAlt":"Legacy image alt","image":"/assets/capability.webp"}',
      '{"heading":"Legacy heading","tagLine":"Legacy tagline"}'
    );
    INSERT INTO section (id, title, content, constant) VALUES (
      8,
      'Home cards',
      '{"image":"/assets/home-section.png","serviceCard":[{"title":"Service A","heading":"Service heading","description":"Service description","ctaHref":"/services/a/","image":"/assets/service.png"}],"breakPoints":[{"heading":"Breakpoint heading","description":"Breakpoint description"}],"stats":[{"value":"20x","label":"Years of Expertise"}],"teamMembers":[{"name":"Ada Lovelace","role":"Engineer"}],"steps":[{"label":"Discover","description":"Scope the work"}],"featured":[{"title":"Featured Project","type":"featured","tags":["Shipped"]}],"cards":[{"title":"Telemetry","type":"telemetryMetric","tags":[{"id":"legacy-tag-id","tag":"Telemetry"}]},{"title":"Existing media card","image":{"id":42,"url":"/media/real-upload.png"}}],"mockup":{"assistantName":"Callie","schedulingMessage":"Choose a time","timeSlots":["10:00 AM"],"syncTitle":"PCB sync","telemetryTitle":"Live telemetry","telemetryMetrics":["CAN: 1.2 ms"]},"imageLabels":["Process image"]}',
      '{}'
    );
    INSERT INTO header (id, nav_items, nav_cta_label, nav_cta_url) VALUES (1, '[{"label":"Work","url":"/work/"}]', 'Start a project', 'mailto:hello@example.test');
    ${includeLegacyFooter ? `INSERT INTO footer (id, content) VALUES (1, '{"heading":"Legacy footer","cta":{"label":"Get in touch","href":"/contact/"},"socialLinks":[{"label":"LinkedIn","href":"https://example.test/linkedin","icon":"linkedin"}],${includeFooterCopyright ? '"copyright":"© Legacy Canopy",' : ''}"helplineNumber":"+1999 888-76-54"}');` : ''}
  `)

  const calls: string[] = []
  const db = {
    all: async (query: Parameters<typeof dialect.sqlToQuery>[0]) => {
      const compiled = dialect.sqlToQuery(query)
      calls.push(compiled.sql)
      return sqlite.prepare(compiled.sql).all(...(compiled.params as (string | number | bigint | Uint8Array | null)[]))
    },
    run: async (query: Parameters<typeof dialect.sqlToQuery>[0]) => {
      const compiled = dialect.sqlToQuery(query)
      calls.push(compiled.sql)
      return sqlite.prepare(compiled.sql).run(...(compiled.params as (string | number | bigint | Uint8Array | null)[]))
    },
  }
  return { sqlite, db, calls }
}

function createPayloadRecorder(sqlite: DatabaseSync) {
  const updates: { collection: string; id: string | number; data: Record<string, unknown> }[] = []
  const globalUpdates: { slug: string; data: Record<string, unknown> }[] = []
  const creates: { collection: string; data: Record<string, unknown> }[] = []
  let nextCardId = 100
  const payload = {
    update: async ({ collection, id, data }: { collection: string; id: string | number; data: Record<string, unknown> }) => {
      if (collection === 'card' && typeof data.image === 'string' && data.image.startsWith('/')) {
        throw new Error('Payload card update received a path string as an upload relation')
      }
      if (collection === 'section') {
        if (typeof data.image === 'string' && data.image.startsWith('/')) {
          throw new Error('Payload section update received a path string as an upload relation')
        }
        const sectionColumns = new Set(
          (sqlite.prepare('PRAGMA table_info(`section`)').all() as { name: string }[]).map(({ name }) => name),
        )
        const requiredColumns = [
          'section_key',
          'image_url',
          'heading_first_line',
          'heading_second_line',
          'logo',
          'summary',
          'preview_alt',
          'mockup_assistant_name',
          'mockup_scheduling_message',
          'mockup_sync_title',
          'mockup_telemetry_title',
        ]
        for (const column of requiredColumns) {
          if (!sectionColumns.has(column)) throw new Error(`Payload section update missing destination column ${column}`)
        }
        for (const table of [
          'section_categories',
          'section_image_labels',
          'section_mockup_time_slots',
          'section_mockup_telemetry_metrics',
        ]) {
          const exists = sqlite
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
            .get(table)
          if (!exists) throw new Error(`Payload section update missing destination table ${table}`)
        }
        if (typeof id === 'number' && Array.isArray(data.imageLabels)) {
          const insertLabel = sqlite.prepare(
            'INSERT INTO section_image_labels (_order, _parent_id, id, label) VALUES (?, ?, ?, ?)',
          )
          data.imageLabels.forEach((entry, index) => {
            insertLabel.run(
              index,
              id,
              `section-image-label-${id}-${index}`,
              String((entry as { label: unknown }).label ?? ''),
            )
          })
        }
        if (typeof id === 'number') {
          sqlite.prepare('UPDATE section SET image_id = ?, image_url = ? WHERE id = ?').run(
            typeof data.image === 'number' ? data.image : null,
            typeof data.imageUrl === 'string' ? data.imageUrl : null,
            id,
          )
        }
        const mockup = data.mockup as Record<string, unknown> | undefined
        if (mockup && typeof id === 'number') {
          sqlite.prepare(`
            UPDATE section
            SET image_url = ?,
                mockup_assistant_name = ?,
                mockup_scheduling_message = ?,
                mockup_sync_title = ?,
                mockup_telemetry_title = ?
            WHERE id = ?
          `).run(
              typeof data.imageUrl === 'string' ? data.imageUrl : null,
              typeof mockup.assistantName === 'string' ? mockup.assistantName : null,
              typeof mockup.schedulingMessage === 'string' ? mockup.schedulingMessage : null,
              typeof mockup.syncTitle === 'string' ? mockup.syncTitle : null,
              typeof mockup.telemetryTitle === 'string' ? mockup.telemetryTitle : null,
            id,
          )
          for (const [table, values] of [
            ['section_mockup_time_slots', mockup.timeSlots],
            ['section_mockup_telemetry_metrics', mockup.telemetryMetrics],
          ] as const) {
            if (!Array.isArray(values)) continue
            const insert = sqlite.prepare(`INSERT INTO \`${table}\` (_order, _parent_id, id, value) VALUES (?, ?, ?, ?)`)
            values.forEach((entry, index) => {
              const value = typeof entry === 'string' ? entry : (entry as { value: string }).value
              insert.run(index, id, `${table}-${id}-${index}`, value)
            })
          }
        }
      }
      updates.push({ collection, id, data })
      return { id }
    },
    find: async () => ({ docs: [] as { id: number | string }[] }),
    create: async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
      if (collection === 'card' && typeof data.image === 'string' && data.image.startsWith('/')) {
        throw new Error('Payload card create received a path string as an upload relation')
      }
      creates.push({ collection, data })
      if (collection === 'card') {
        const cardColumns = new Set(
          (sqlite.prepare('PRAGMA table_info(`card`)').all() as { name: string }[]).map(({ name }) => name),
        )
        if (!cardColumns.has('image_url')) throw new Error('Payload card create missing destination column image_url')
        sqlite.prepare('INSERT INTO card (id, title, image_id, image_url) VALUES (?, ?, ?, ?)').run(
          nextCardId,
          String(data.title),
          typeof data.image === 'number' ? data.image : null,
          typeof data.imageUrl === 'string' ? data.imageUrl : null,
        )
      }
      return { id: nextCardId++ }
    },
    updateGlobal: async ({ slug, data }: { slug: string; data: Record<string, unknown> }) => {
      globalUpdates.push({ slug, data })
      return {}
    },
  }
  return { payload, updates, globalUpdates, creates }
}

describe('typed content-model migration', () => {
  it('reads legacy SQL JSON before DDL and transfers representative page, section, header, and footer values', async () => {
    const { sqlite, db, calls } = createMigrationDatabase()
    const { payload, updates, globalUpdates, creates } = createPayloadRecorder(sqlite)

    await up({ db, payload } as never)

    const firstMutation = calls.findIndex((statement) => !statement.startsWith('PRAGMA') && !statement.startsWith('SELECT'))
    const lastLegacyRead = Math.max(
      ...calls.map((statement, index) =>
        /SELECT id, (constant|content|nav_items)/.test(statement) ? index : -1,
      ),
    )
    expect(lastLegacyRead).toBeGreaterThanOrEqual(0)
    expect(firstMutation).toBeGreaterThan(lastLegacyRead)

    const page = updates.find((entry) => entry.collection === 'page')
    const section = updates.find((entry) => entry.collection === 'section')
    expect(page?.data.heading).toBe('Legacy page heading')
    expect(section?.data.sectionKey).toBe('capability-detail')
    expect(section?.data.heading).toBe('Typed heading')
    expect(section?.data.imageAlt).toBe('Legacy image alt')
    expect(section?.data.imageUrl).toBe('/assets/capability.webp')
    expect(section?.data).not.toHaveProperty('image')

    const homeCardsSection = updates.find((entry) => entry.collection === 'section' && entry.id === 8)
    const createdCards = creates.filter((entry) => entry.collection === 'card')
    expect(homeCardsSection?.data.cards).toEqual([100, 101, 102, 103, 104, 105, 106, 107])
    expect(createdCards.map(({ data }) => [data.title, data.type])).toEqual([
      ['Telemetry', 'telemetryMetric'],
      ['Existing media card', 'cards'],
      ['Service A', 'service'],
      ['Breakpoint heading', 'breakpoint'],
      ['Years of Expertise', 'stat'],
      ['Ada Lovelace', 'teamMember'],
      ['Discover', 'step'],
      ['Featured Project', 'card'],
    ])
    expect(createdCards[2].data.ctaUrl).toBe('/services/a/')
    expect(createdCards[2].data.imageUrl).toBe('/assets/service.png')
    expect(createdCards[2].data).not.toHaveProperty('image')
    expect(createdCards[1].data.image).toBe(42)
    expect(createdCards[1].data.imageUrl).toBe('/media/real-upload.png')
    expect(
      sqlite.prepare('SELECT image_id, image_url FROM card WHERE id = 102').get(),
    ).toMatchObject({ image_url: '/assets/service.png' })
    expect(sqlite.prepare('SELECT image_id FROM card WHERE id = 101').get()).toMatchObject({ image_id: 42 })
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM media').get()).toMatchObject({ count: 1 })
    expect(createdCards[4].data.value).toBe('20x')
    expect(createdCards[0].data.tags).toEqual([{ tag: 'Telemetry' }])
    expect(createdCards[7].data.tags).toEqual([{ tag: 'Shipped' }])
    expect(
      (sqlite.prepare('SELECT image_url, mockup_assistant_name, mockup_scheduling_message, mockup_sync_title, mockup_telemetry_title FROM section WHERE id = 8').get() as Record<string, string>),
    ).toMatchObject({
      image_url: '/assets/home-section.png',
      mockup_assistant_name: 'Callie',
      mockup_scheduling_message: 'Choose a time',
      mockup_sync_title: 'PCB sync',
      mockup_telemetry_title: 'Live telemetry',
    })
    expect(sqlite.prepare('SELECT image_url FROM section WHERE id = 7').get()).toMatchObject({
      image_url: '/assets/capability.webp',
    })
    expect(
      (sqlite.prepare('SELECT value FROM section_mockup_time_slots WHERE _parent_id = 8 ORDER BY _order').all() as { value: string }[])
        .map(({ value }) => value),
    ).toEqual(['10:00 AM'])
    expect(
      (sqlite.prepare('SELECT value FROM section_mockup_telemetry_metrics WHERE _parent_id = 8 ORDER BY _order').all() as { value: string }[])
        .map(({ value }) => value),
    ).toEqual(['CAN: 1.2 ms'])
    expect(
      (sqlite.prepare('SELECT label FROM section_image_labels WHERE _parent_id = 8 ORDER BY _order').all() as { label: string }[])
        .map(({ label }) => label),
    ).toEqual(['Process image'])

    expect(globalUpdates.find((entry) => entry.slug === 'header')?.data).toMatchObject({
      navItems: [{ label: 'Work', url: '/work/' }],
      navCta: { label: 'Start a project', href: 'mailto:hello@example.test' },
    })
    expect(globalUpdates.find((entry) => entry.slug === 'footer')?.data).toMatchObject({
      heading: 'Legacy footer',
      helplineNumber: '+1999 888-76-54',
      cta: { label: 'Get in touch', href: '/contact/' },
      socialLinks: [{ label: 'LinkedIn', href: 'https://example.test/linkedin', icon: 'linkedin' }],
      copyright: '© Legacy Canopy',
    })

    for (const [table, column] of [
      ['page', 'constant'],
      ['section', 'content'],
      ['section', 'constant'],
      ['header', 'nav_items'],
      ['footer', 'content'],
    ]) {
      const columns = sqlite.prepare(`PRAGMA table_info(\`${table}\`)`).all() as { name: string }[]
      expect(columns.some((entry) => entry.name === column), `${table}.${column} should be removed after migration`).toBe(false)
    }
    sqlite.close()
  })

  it('does not clear typed Footer copyright when legacy JSON has no copyright key', async () => {
    const { sqlite, db } = createMigrationDatabase(true, false)
    const { payload, globalUpdates } = createPayloadRecorder(sqlite)

    await up({ db, payload } as never)

    const footerUpdate = globalUpdates.find((entry) => entry.slug === 'footer')
    expect(footerUpdate?.data).not.toHaveProperty('copyright')
    sqlite.close()
  })

  it('fails before schema changes when the legacy source column is missing', async () => {
    const { sqlite, db, calls } = createMigrationDatabase(false)
    const { payload } = createPayloadRecorder(sqlite)

    await expect(up({ db, payload } as never)).rejects.toThrow('expected footer.content to exist')
    expect(calls.some((statement) => statement.startsWith('ALTER TABLE') || statement.startsWith('CREATE TABLE'))).toBe(false)
    sqlite.close()
  })
})

import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-d1-sqlite'

async function columns(db: MigrateUpArgs['db'], table: string): Promise<{ name?: string }[]> {
  const result = await db.all(sql.raw(`PRAGMA table_info(\`${table}\`)`))
  return result
}

async function addColumn(
  db: MigrateUpArgs['db'],
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  const existing = await columns(db, table)
  if (!existing.some((entry) => entry.name === column)) {
    await db.run(sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`))
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await addColumn(db, 'section', 'image_url', 'text')
  await addColumn(db, 'card', 'image_url', 'text')
  await addColumn(db, 'section', 'section_key', 'text')
  await addColumn(db, 'section', 'heading_first_line', 'text')
  await addColumn(db, 'section', 'heading_second_line', 'text')
  await addColumn(db, 'section', 'logo', 'text')
  await addColumn(db, 'section', 'summary', 'text')
  await addColumn(db, 'section', 'preview_alt', 'text')
  await addColumn(db, 'section', 'mockup_assistant_name', 'text')
  await addColumn(db, 'section', 'mockup_scheduling_message', 'text')
  await addColumn(db, 'section', 'mockup_sync_title', 'text')
  await addColumn(db, 'section', 'mockup_telemetry_title', 'text')

  await db.run(sql`CREATE TABLE IF NOT EXISTS section_image_labels (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    id text PRIMARY KEY NOT NULL,
    label text,
    FOREIGN KEY (_parent_id) REFERENCES section(id) ON DELETE cascade
  )`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS section_image_labels_order_idx ON section_image_labels (_order)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS section_image_labels_parent_id_idx ON section_image_labels (_parent_id)`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS section_mockup_time_slots (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    id text PRIMARY KEY NOT NULL,
    value text,
    FOREIGN KEY (_parent_id) REFERENCES section(id) ON DELETE cascade
  )`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS section_mockup_time_slots_order_idx ON section_mockup_time_slots (_order)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS section_mockup_time_slots_parent_id_idx ON section_mockup_time_slots (_parent_id)`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS section_mockup_telemetry_metrics (
    _order integer NOT NULL,
    _parent_id integer NOT NULL,
    id text PRIMARY KEY NOT NULL,
    value text,
    FOREIGN KEY (_parent_id) REFERENCES section(id) ON DELETE cascade
  )`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS section_mockup_telemetry_metrics_order_idx ON section_mockup_telemetry_metrics (_order)`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS section_mockup_telemetry_metrics_parent_id_idx ON section_mockup_telemetry_metrics (_parent_id)`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  void db
  throw new Error('The Section mapping-fields migration is irreversible; restore the database backup instead.')
}

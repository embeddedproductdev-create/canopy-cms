import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-d1-sqlite'
import { sql } from '@payloadcms/db-d1-sqlite'

type Row = { name: string }

const tables = [
  {
    name: 'case_study_overview',
    create: `CREATE TABLE "case_study_overview" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" text PRIMARY KEY NOT NULL,
      "label" text NOT NULL,
      "text" text,
      FOREIGN KEY ("_parent_id") REFERENCES "case_study"("id") ON UPDATE no action ON DELETE cascade
    )`,
  },
  {
    name: 'case_study_spec_groups',
    create: `CREATE TABLE "case_study_spec_groups" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" text PRIMARY KEY NOT NULL,
      "heading" text NOT NULL,
      FOREIGN KEY ("_parent_id") REFERENCES "case_study"("id") ON UPDATE no action ON DELETE cascade
    )`,
  },
  {
    name: 'case_study_spec_groups_rows',
    create: `CREATE TABLE "case_study_spec_groups_rows" (
      "_order" integer NOT NULL,
      "_parent_id" text NOT NULL,
      "id" text PRIMARY KEY NOT NULL,
      "label" text NOT NULL,
      "value" text,
      "built_in" integer DEFAULT false,
      FOREIGN KEY ("_parent_id") REFERENCES "case_study_spec_groups"("id") ON UPDATE no action ON DELETE cascade
    )`,
  },
  {
    name: '_case_study_v_version_overview',
    create: `CREATE TABLE "_case_study_v_version_overview" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" integer PRIMARY KEY NOT NULL,
      "label" text,
      "text" text,
      "_uuid" text,
      FOREIGN KEY ("_parent_id") REFERENCES "_case_study_v"("id") ON UPDATE no action ON DELETE cascade
    )`,
  },
  {
    name: '_case_study_v_version_spec_groups',
    create: `CREATE TABLE "_case_study_v_version_spec_groups" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" integer PRIMARY KEY NOT NULL,
      "heading" text,
      "_uuid" text,
      FOREIGN KEY ("_parent_id") REFERENCES "_case_study_v"("id") ON UPDATE no action ON DELETE cascade
    )`,
  },
  {
    name: '_case_study_v_version_spec_groups_rows',
    create: `CREATE TABLE "_case_study_v_version_spec_groups_rows" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" integer PRIMARY KEY NOT NULL,
      "label" text,
      "value" text,
      "built_in" integer DEFAULT false,
      "_uuid" text,
      FOREIGN KEY ("_parent_id") REFERENCES "_case_study_v_version_spec_groups"("id") ON UPDATE no action ON DELETE cascade
    )`,
  },
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  const existing = new Set(
    ((await db.all(sql`SELECT "name" FROM "sqlite_master" WHERE "type" = 'table'`)) as Row[]).map((row) => row.name),
  )

  for (const table of tables) {
    if (!existing.has(table.name)) await db.run(sql.raw(table.create))
    await db.run(sql.raw(`CREATE INDEX IF NOT EXISTS "${table.name}_order_idx" ON "${table.name}" ("_order")`))
    await db.run(sql.raw(`CREATE INDEX IF NOT EXISTS "${table.name}_parent_id_idx" ON "${table.name}" ("_parent_id")`))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  void db
}

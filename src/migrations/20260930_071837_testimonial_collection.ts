import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`testimonial\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`heading\` text NOT NULL,
  	\`client_label\` text DEFAULT 'Canopy client',
  	\`quote\` text NOT NULL,
  	\`order\` numeric DEFAULT 0,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`testimonial_updated_at_idx\` ON \`testimonial\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`testimonial_created_at_idx\` ON \`testimonial\` (\`created_at\`);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`testimonial_id\` integer REFERENCES testimonial(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_testimonial_id_idx\` ON \`payload_locked_documents_rels\` (\`testimonial_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`testimonial\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`user_id\` integer,
  	\`media_id\` integer,
  	\`page_id\` integer,
  	\`section_id\` integer,
  	\`card_id\` integer,
  	\`case_study_id\` integer,
  	\`blog_id\` integer,
  	\`checklist_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`page_id\`) REFERENCES \`page\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`section_id\`) REFERENCES \`section\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`card_id\`) REFERENCES \`card\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`case_study_id\`) REFERENCES \`case_study\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`blog_id\`) REFERENCES \`blog\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`checklist_id\`) REFERENCES \`checklist\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "user_id", "media_id", "page_id", "section_id", "card_id", "case_study_id", "blog_id", "checklist_id") SELECT "id", "order", "parent_id", "path", "user_id", "media_id", "page_id", "section_id", "card_id", "case_study_id", "blog_id", "checklist_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_user_id_idx\` ON \`payload_locked_documents_rels\` (\`user_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_page_id_idx\` ON \`payload_locked_documents_rels\` (\`page_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_section_id_idx\` ON \`payload_locked_documents_rels\` (\`section_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_card_id_idx\` ON \`payload_locked_documents_rels\` (\`card_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_case_study_id_idx\` ON \`payload_locked_documents_rels\` (\`case_study_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_blog_id_idx\` ON \`payload_locked_documents_rels\` (\`blog_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_checklist_id_idx\` ON \`payload_locked_documents_rels\` (\`checklist_id\`);`)
}

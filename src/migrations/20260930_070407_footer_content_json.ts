import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`user_sessions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`created_at\` text,
  	\`expires_at\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`user_sessions_order_idx\` ON \`user_sessions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`user_sessions_parent_id_idx\` ON \`user_sessions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`user\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`role\` text DEFAULT 'viewer' NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`email\` text NOT NULL,
  	\`reset_password_token\` text,
  	\`reset_password_expiration\` text,
  	\`salt\` text,
  	\`hash\` text,
  	\`login_attempts\` numeric DEFAULT 0,
  	\`lock_until\` text
  );
  `)
  await db.run(sql`CREATE INDEX \`user_updated_at_idx\` ON \`user\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`user_created_at_idx\` ON \`user\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`user_email_idx\` ON \`user\` (\`email\`);`)
  await db.run(sql`CREATE TABLE \`page_pills\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`label\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`page\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`page_pills_order_idx\` ON \`page_pills\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`page_pills_parent_id_idx\` ON \`page_pills\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`page_faqs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`question\` text,
  	\`answer\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`page\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`page_faqs_order_idx\` ON \`page_faqs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`page_faqs_parent_id_idx\` ON \`page_faqs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`page_workflow_steps\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`step_number\` numeric,
  	\`title\` text,
  	\`description\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`page\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`page_workflow_steps_order_idx\` ON \`page_workflow_steps\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`page_workflow_steps_parent_id_idx\` ON \`page_workflow_steps\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`page_team_members\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`role\` text,
  	\`bio\` text,
  	\`photo_id\` integer,
  	FOREIGN KEY (\`photo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`page\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`page_team_members_order_idx\` ON \`page_team_members\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`page_team_members_parent_id_idx\` ON \`page_team_members\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`page_team_members_photo_idx\` ON \`page_team_members\` (\`photo_id\`);`)
  await db.run(sql`CREATE TABLE \`page_company_facts_sectors\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`sector\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`page\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`page_company_facts_sectors_order_idx\` ON \`page_company_facts_sectors\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`page_company_facts_sectors_parent_id_idx\` ON \`page_company_facts_sectors\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`page\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`heading\` text,
  	\`subheading\` text,
  	\`url\` text,
  	\`body\` text,
  	\`constant\` text,
  	\`company_facts_name\` text,
  	\`company_facts_location\` text,
  	\`company_facts_contact_email\` text,
  	\`seo_seo_title\` text,
  	\`seo_meta_description\` text,
  	\`seo_canonical_url\` text,
  	\`seo_robots_index\` integer DEFAULT true,
  	\`seo_robots_follow\` integer DEFAULT true,
  	\`seo_schema_type\` text DEFAULT 'none',
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`_status\` text DEFAULT 'draft'
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`page_url_idx\` ON \`page\` (\`url\`);`)
  await db.run(sql`CREATE INDEX \`page_updated_at_idx\` ON \`page\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`page_created_at_idx\` ON \`page\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`page__status_idx\` ON \`page\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`page_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`section_id\` integer,
  	\`card_id\` integer,
  	\`case_study_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`page\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`section_id\`) REFERENCES \`section\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`card_id\`) REFERENCES \`card\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`case_study_id\`) REFERENCES \`case_study\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`page_rels_order_idx\` ON \`page_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`page_rels_parent_idx\` ON \`page_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`page_rels_path_idx\` ON \`page_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`page_rels_section_id_idx\` ON \`page_rels\` (\`section_id\`);`)
  await db.run(sql`CREATE INDEX \`page_rels_card_id_idx\` ON \`page_rels\` (\`card_id\`);`)
  await db.run(sql`CREATE INDEX \`page_rels_case_study_id_idx\` ON \`page_rels\` (\`case_study_id\`);`)
  await db.run(sql`CREATE TABLE \`_page_v_version_pills\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`label\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_page_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_page_v_version_pills_order_idx\` ON \`_page_v_version_pills\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_page_v_version_pills_parent_id_idx\` ON \`_page_v_version_pills\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_page_v_version_faqs\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`question\` text,
  	\`answer\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_page_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_page_v_version_faqs_order_idx\` ON \`_page_v_version_faqs\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_page_v_version_faqs_parent_id_idx\` ON \`_page_v_version_faqs\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_page_v_version_workflow_steps\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`step_number\` numeric,
  	\`title\` text,
  	\`description\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_page_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_page_v_version_workflow_steps_order_idx\` ON \`_page_v_version_workflow_steps\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_page_v_version_workflow_steps_parent_id_idx\` ON \`_page_v_version_workflow_steps\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_page_v_version_team_members\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`role\` text,
  	\`bio\` text,
  	\`photo_id\` integer,
  	\`_uuid\` text,
  	FOREIGN KEY (\`photo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_page_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_page_v_version_team_members_order_idx\` ON \`_page_v_version_team_members\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_page_v_version_team_members_parent_id_idx\` ON \`_page_v_version_team_members\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_page_v_version_team_members_photo_idx\` ON \`_page_v_version_team_members\` (\`photo_id\`);`)
  await db.run(sql`CREATE TABLE \`_page_v_version_company_facts_sectors\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`sector\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_page_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_page_v_version_company_facts_sectors_order_idx\` ON \`_page_v_version_company_facts_sectors\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_page_v_version_company_facts_sectors_parent_id_idx\` ON \`_page_v_version_company_facts_sectors\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_page_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_title\` text,
  	\`version_heading\` text,
  	\`version_subheading\` text,
  	\`version_url\` text,
  	\`version_body\` text,
  	\`version_constant\` text,
  	\`version_company_facts_name\` text,
  	\`version_company_facts_location\` text,
  	\`version_company_facts_contact_email\` text,
  	\`version_seo_seo_title\` text,
  	\`version_seo_meta_description\` text,
  	\`version_seo_canonical_url\` text,
  	\`version_seo_robots_index\` integer DEFAULT true,
  	\`version_seo_robots_follow\` integer DEFAULT true,
  	\`version_seo_schema_type\` text DEFAULT 'none',
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`latest\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`page\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_page_v_parent_idx\` ON \`_page_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_page_v_version_version_url_idx\` ON \`_page_v\` (\`version_url\`);`)
  await db.run(sql`CREATE INDEX \`_page_v_version_version_updated_at_idx\` ON \`_page_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_page_v_version_version_created_at_idx\` ON \`_page_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_page_v_version_version__status_idx\` ON \`_page_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_page_v_created_at_idx\` ON \`_page_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_page_v_updated_at_idx\` ON \`_page_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_page_v_latest_idx\` ON \`_page_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`_page_v_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`section_id\` integer,
  	\`card_id\` integer,
  	\`case_study_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`_page_v\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`section_id\`) REFERENCES \`section\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`card_id\`) REFERENCES \`card\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`case_study_id\`) REFERENCES \`case_study\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_page_v_rels_order_idx\` ON \`_page_v_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`_page_v_rels_parent_idx\` ON \`_page_v_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_page_v_rels_path_idx\` ON \`_page_v_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`_page_v_rels_section_id_idx\` ON \`_page_v_rels\` (\`section_id\`);`)
  await db.run(sql`CREATE INDEX \`_page_v_rels_card_id_idx\` ON \`_page_v_rels\` (\`card_id\`);`)
  await db.run(sql`CREATE INDEX \`_page_v_rels_case_study_id_idx\` ON \`_page_v_rels\` (\`case_study_id\`);`)
  await db.run(sql`CREATE TABLE \`section\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text NOT NULL,
  	\`heading\` text,
  	\`subheading\` text,
  	\`image_id\` integer,
  	\`body\` text,
  	\`constant\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`section_image_idx\` ON \`section\` (\`image_id\`);`)
  await db.run(sql`CREATE INDEX \`section_updated_at_idx\` ON \`section\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`section_created_at_idx\` ON \`section\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`section_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`card_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`section\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`card_id\`) REFERENCES \`card\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`section_rels_order_idx\` ON \`section_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`section_rels_parent_idx\` ON \`section_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`section_rels_path_idx\` ON \`section_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`section_rels_card_id_idx\` ON \`section_rels\` (\`card_id\`);`)
  await db.run(sql`CREATE TABLE \`card\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text NOT NULL,
  	\`heading\` text,
  	\`subheading\` text,
  	\`category\` text,
  	\`image_id\` integer,
  	\`description\` text,
  	\`additional_description\` text,
  	\`cta_label\` text,
  	\`cta_url\` text,
  	\`type\` text,
  	\`tags\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`card_image_idx\` ON \`card\` (\`image_id\`);`)
  await db.run(sql`CREATE INDEX \`card_updated_at_idx\` ON \`card\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`card_created_at_idx\` ON \`card\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`case_study_images_page_images\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`image_id\` integer,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_study\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_study_images_page_images_order_idx\` ON \`case_study_images_page_images\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_study_images_page_images_parent_id_idx\` ON \`case_study_images_page_images\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`case_study_images_page_images_image_idx\` ON \`case_study_images_page_images\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`case_study_at_a_glance\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`label\` text,
  	\`value\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_study\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_study_at_a_glance_order_idx\` ON \`case_study_at_a_glance\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_study_at_a_glance_parent_id_idx\` ON \`case_study_at_a_glance\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_study_features\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`item\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_study\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_study_features_order_idx\` ON \`case_study_features\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_study_features_parent_id_idx\` ON \`case_study_features\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_study_technical_specifications\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`item\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`case_study\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`case_study_technical_specifications_order_idx\` ON \`case_study_technical_specifications\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`case_study_technical_specifications_parent_id_idx\` ON \`case_study_technical_specifications\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`case_study\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`slug\` text,
  	\`heading\` text,
  	\`subheading\` text,
  	\`category\` text,
  	\`body\` text,
  	\`tags\` text,
  	\`images_landing_image_id\` integer,
  	\`card_cta_label\` text,
  	\`card_cta_link\` text,
  	\`page_cta_label\` text,
  	\`page_cta_link\` text,
  	\`project_stage\` text,
  	\`seo_seo_title\` text,
  	\`seo_meta_description\` text,
  	\`seo_canonical_url\` text,
  	\`seo_robots_index\` integer DEFAULT true,
  	\`seo_robots_follow\` integer DEFAULT true,
  	\`seo_schema_type\` text DEFAULT 'none',
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`images_landing_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`case_study_slug_idx\` ON \`case_study\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`case_study_images_images_landing_image_idx\` ON \`case_study\` (\`images_landing_image_id\`);`)
  await db.run(sql`CREATE INDEX \`case_study_updated_at_idx\` ON \`case_study\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`case_study_created_at_idx\` ON \`case_study\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`case_study__status_idx\` ON \`case_study\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_case_study_v_version_images_page_images\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`image_id\` integer,
  	\`_uuid\` text,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_study_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_study_v_version_images_page_images_order_idx\` ON \`_case_study_v_version_images_page_images\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_study_v_version_images_page_images_parent_id_idx\` ON \`_case_study_v_version_images_page_images\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_study_v_version_images_page_images_image_idx\` ON \`_case_study_v_version_images_page_images\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_study_v_version_at_a_glance\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`label\` text,
  	\`value\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_study_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_study_v_version_at_a_glance_order_idx\` ON \`_case_study_v_version_at_a_glance\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_study_v_version_at_a_glance_parent_id_idx\` ON \`_case_study_v_version_at_a_glance\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_study_v_version_features\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`item\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_study_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_study_v_version_features_order_idx\` ON \`_case_study_v_version_features\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_study_v_version_features_parent_id_idx\` ON \`_case_study_v_version_features\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_study_v_version_technical_specifications\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`item\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_case_study_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_study_v_version_technical_specifications_order_idx\` ON \`_case_study_v_version_technical_specifications\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_case_study_v_version_technical_specifications_parent_id_idx\` ON \`_case_study_v_version_technical_specifications\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_case_study_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_title\` text,
  	\`version_slug\` text,
  	\`version_heading\` text,
  	\`version_subheading\` text,
  	\`version_category\` text,
  	\`version_body\` text,
  	\`version_tags\` text,
  	\`version_images_landing_image_id\` integer,
  	\`version_card_cta_label\` text,
  	\`version_card_cta_link\` text,
  	\`version_page_cta_label\` text,
  	\`version_page_cta_link\` text,
  	\`version_project_stage\` text,
  	\`version_seo_seo_title\` text,
  	\`version_seo_meta_description\` text,
  	\`version_seo_canonical_url\` text,
  	\`version_seo_robots_index\` integer DEFAULT true,
  	\`version_seo_robots_follow\` integer DEFAULT true,
  	\`version_seo_schema_type\` text DEFAULT 'none',
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`latest\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`case_study\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_images_landing_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_case_study_v_parent_idx\` ON \`_case_study_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_study_v_version_version_slug_idx\` ON \`_case_study_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_case_study_v_version_images_version_images_landing_imag_idx\` ON \`_case_study_v\` (\`version_images_landing_image_id\`);`)
  await db.run(sql`CREATE INDEX \`_case_study_v_version_version_updated_at_idx\` ON \`_case_study_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_case_study_v_version_version_created_at_idx\` ON \`_case_study_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_case_study_v_version_version__status_idx\` ON \`_case_study_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_case_study_v_created_at_idx\` ON \`_case_study_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_case_study_v_updated_at_idx\` ON \`_case_study_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_case_study_v_latest_idx\` ON \`_case_study_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`blog_tags\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`tag\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`blog\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`blog_tags_order_idx\` ON \`blog_tags\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`blog_tags_parent_id_idx\` ON \`blog_tags\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`blog_related_links\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`label\` text,
  	\`url\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`blog\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`blog_related_links_order_idx\` ON \`blog_related_links\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`blog_related_links_parent_id_idx\` ON \`blog_related_links\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`blog\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`slug\` text,
  	\`heading\` text,
  	\`dek\` text,
  	\`byline\` text,
  	\`published_date\` text,
  	\`updated_date\` text,
  	\`body\` text,
  	\`content_upgrade_label\` text,
  	\`content_upgrade_checklist_link_id\` integer,
  	\`seo_seo_title\` text,
  	\`seo_meta_description\` text,
  	\`seo_canonical_url\` text,
  	\`seo_robots_index\` integer DEFAULT true,
  	\`seo_robots_follow\` integer DEFAULT true,
  	\`seo_schema_type\` text DEFAULT 'none',
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`content_upgrade_checklist_link_id\`) REFERENCES \`checklist\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`blog_slug_idx\` ON \`blog\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`blog_content_upgrade_content_upgrade_checklist_link_idx\` ON \`blog\` (\`content_upgrade_checklist_link_id\`);`)
  await db.run(sql`CREATE INDEX \`blog_updated_at_idx\` ON \`blog\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`blog_created_at_idx\` ON \`blog\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`blog__status_idx\` ON \`blog\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_blog_v_version_tags\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`tag\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_blog_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_blog_v_version_tags_order_idx\` ON \`_blog_v_version_tags\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_blog_v_version_tags_parent_id_idx\` ON \`_blog_v_version_tags\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_blog_v_version_related_links\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`label\` text,
  	\`url\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_blog_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_blog_v_version_related_links_order_idx\` ON \`_blog_v_version_related_links\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_blog_v_version_related_links_parent_id_idx\` ON \`_blog_v_version_related_links\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_blog_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_title\` text,
  	\`version_slug\` text,
  	\`version_heading\` text,
  	\`version_dek\` text,
  	\`version_byline\` text,
  	\`version_published_date\` text,
  	\`version_updated_date\` text,
  	\`version_body\` text,
  	\`version_content_upgrade_label\` text,
  	\`version_content_upgrade_checklist_link_id\` integer,
  	\`version_seo_seo_title\` text,
  	\`version_seo_meta_description\` text,
  	\`version_seo_canonical_url\` text,
  	\`version_seo_robots_index\` integer DEFAULT true,
  	\`version_seo_robots_follow\` integer DEFAULT true,
  	\`version_seo_schema_type\` text DEFAULT 'none',
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`latest\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`blog\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_content_upgrade_checklist_link_id\`) REFERENCES \`checklist\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_blog_v_parent_idx\` ON \`_blog_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_blog_v_version_version_slug_idx\` ON \`_blog_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_blog_v_version_content_upgrade_version_content_upgrade__idx\` ON \`_blog_v\` (\`version_content_upgrade_checklist_link_id\`);`)
  await db.run(sql`CREATE INDEX \`_blog_v_version_version_updated_at_idx\` ON \`_blog_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_blog_v_version_version_created_at_idx\` ON \`_blog_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_blog_v_version_version__status_idx\` ON \`_blog_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_blog_v_created_at_idx\` ON \`_blog_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_blog_v_updated_at_idx\` ON \`_blog_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_blog_v_latest_idx\` ON \`_blog_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`checklist_visible_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`item\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`checklist\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`checklist_visible_items_order_idx\` ON \`checklist_visible_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`checklist_visible_items_parent_id_idx\` ON \`checklist_visible_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`checklist\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text,
  	\`slug\` text,
  	\`locked_items_count\` numeric DEFAULT 7,
  	\`pdf_asset_id\` integer,
  	\`form_id\` text,
  	\`seo_seo_title\` text,
  	\`seo_meta_description\` text,
  	\`seo_canonical_url\` text,
  	\`seo_robots_index\` integer DEFAULT true,
  	\`seo_robots_follow\` integer DEFAULT true,
  	\`seo_schema_type\` text DEFAULT 'none',
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`_status\` text DEFAULT 'draft',
  	FOREIGN KEY (\`pdf_asset_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`checklist_slug_idx\` ON \`checklist\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`checklist_pdf_asset_idx\` ON \`checklist\` (\`pdf_asset_id\`);`)
  await db.run(sql`CREATE INDEX \`checklist_updated_at_idx\` ON \`checklist\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`checklist_created_at_idx\` ON \`checklist\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`checklist__status_idx\` ON \`checklist\` (\`_status\`);`)
  await db.run(sql`CREATE TABLE \`_checklist_v_version_visible_items\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`item\` text,
  	\`_uuid\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`_checklist_v\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`_checklist_v_version_visible_items_order_idx\` ON \`_checklist_v_version_visible_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`_checklist_v_version_visible_items_parent_id_idx\` ON \`_checklist_v_version_visible_items\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`_checklist_v\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`parent_id\` integer,
  	\`version_title\` text,
  	\`version_slug\` text,
  	\`version_locked_items_count\` numeric DEFAULT 7,
  	\`version_pdf_asset_id\` integer,
  	\`version_form_id\` text,
  	\`version_seo_seo_title\` text,
  	\`version_seo_meta_description\` text,
  	\`version_seo_canonical_url\` text,
  	\`version_seo_robots_index\` integer DEFAULT true,
  	\`version_seo_robots_follow\` integer DEFAULT true,
  	\`version_seo_schema_type\` text DEFAULT 'none',
  	\`version_updated_at\` text,
  	\`version_created_at\` text,
  	\`version__status\` text DEFAULT 'draft',
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`latest\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`checklist\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`version_pdf_asset_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`_checklist_v_parent_idx\` ON \`_checklist_v\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`_checklist_v_version_version_slug_idx\` ON \`_checklist_v\` (\`version_slug\`);`)
  await db.run(sql`CREATE INDEX \`_checklist_v_version_version_pdf_asset_idx\` ON \`_checklist_v\` (\`version_pdf_asset_id\`);`)
  await db.run(sql`CREATE INDEX \`_checklist_v_version_version_updated_at_idx\` ON \`_checklist_v\` (\`version_updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_checklist_v_version_version_created_at_idx\` ON \`_checklist_v\` (\`version_created_at\`);`)
  await db.run(sql`CREATE INDEX \`_checklist_v_version_version__status_idx\` ON \`_checklist_v\` (\`version__status\`);`)
  await db.run(sql`CREATE INDEX \`_checklist_v_created_at_idx\` ON \`_checklist_v\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX \`_checklist_v_updated_at_idx\` ON \`_checklist_v\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`_checklist_v_latest_idx\` ON \`_checklist_v\` (\`latest\`);`)
  await db.run(sql`CREATE TABLE \`payload_kv\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`data\` text NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`payload_kv_key_idx\` ON \`payload_kv\` (\`key\`);`)
  await db.run(sql`CREATE TABLE \`header\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`primary_logo_id\` integer,
  	\`secondary_logo_id\` integer,
  	\`nav_items\` text,
  	\`nav_cta_label\` text DEFAULT 'Book a Consultation',
  	\`nav_cta_url\` text DEFAULT '/engagement-model/',
  	\`updated_at\` text,
  	\`created_at\` text,
  	FOREIGN KEY (\`primary_logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`secondary_logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`header_primary_logo_idx\` ON \`header\` (\`primary_logo_id\`);`)
  await db.run(sql`CREATE INDEX \`header_secondary_logo_idx\` ON \`header\` (\`secondary_logo_id\`);`)
  await db.run(sql`CREATE TABLE \`footer\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`logo_id\` integer,
  	\`content\` text,
  	\`updated_at\` text,
  	\`created_at\` text,
  	FOREIGN KEY (\`logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`footer_logo_idx\` ON \`footer\` (\`logo_id\`);`)
  await db.run(sql`CREATE TABLE \`seo_settings_default_keywords\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`keyword\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`seo_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`seo_settings_default_keywords_order_idx\` ON \`seo_settings_default_keywords\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`seo_settings_default_keywords_parent_id_idx\` ON \`seo_settings_default_keywords\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`seo_settings_disallow_paths\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`path\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`seo_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`seo_settings_disallow_paths_order_idx\` ON \`seo_settings_disallow_paths\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`seo_settings_disallow_paths_parent_id_idx\` ON \`seo_settings_disallow_paths\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`seo_settings\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`site_name\` text DEFAULT 'Canopy Embedded' NOT NULL,
  	\`site_url\` text DEFAULT 'https://www.canopyembedded.com' NOT NULL,
  	\`site_tagline\` text,
  	\`title_separator\` text DEFAULT '|',
  	\`default_seo_title\` text,
  	\`default_meta_description\` text,
  	\`organization_organization_name\` text,
  	\`organization_legal_name\` text,
  	\`organization_organization_type\` text DEFAULT 'Organization',
  	\`organization_logo_id\` integer,
  	\`organization_telephone\` text,
  	\`organization_email\` text,
  	\`organization_address_street_address\` text,
  	\`organization_address_address_locality\` text,
  	\`organization_address_address_region\` text,
  	\`organization_address_postal_code\` text,
  	\`organization_address_address_country\` text,
  	\`social_profiles_linkedin\` text,
  	\`social_profiles_facebook\` text,
  	\`social_profiles_twitter\` text,
  	\`social_profiles_youtube\` text,
  	\`social_profiles_instagram\` text,
  	\`open_graph_defaults_og_type\` text DEFAULT 'website',
  	\`open_graph_defaults_og_image_id\` integer,
  	\`open_graph_defaults_og_image_alt\` text,
  	\`twitter_defaults_card_type\` text DEFAULT 'summary_large_image',
  	\`twitter_defaults_site_handle\` text,
  	\`twitter_defaults_creator_handle\` text,
  	\`allow_indexing\` integer DEFAULT true,
  	\`sitemap_url\` text DEFAULT 'https://www.canopyembedded.com/sitemap.xml',
  	\`updated_at\` text,
  	\`created_at\` text,
  	FOREIGN KEY (\`organization_logo_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`open_graph_defaults_og_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`seo_settings_organization_organization_logo_idx\` ON \`seo_settings\` (\`organization_logo_id\`);`)
  await db.run(sql`CREATE INDEX \`seo_settings_open_graph_defaults_open_graph_defaults_og__idx\` ON \`seo_settings\` (\`open_graph_defaults_og_image_id\`);`)
  await db.run(sql`CREATE TABLE \`site_chrome_checklist_modal_fallback_categories\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`label\` text NOT NULL,
  	\`description\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`site_chrome\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`site_chrome_checklist_modal_fallback_categories_order_idx\` ON \`site_chrome_checklist_modal_fallback_categories\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`site_chrome_checklist_modal_fallback_categories_parent_id_idx\` ON \`site_chrome_checklist_modal_fallback_categories\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`site_chrome\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`primary_cta_label\` text DEFAULT 'Talk to an Engineer' NOT NULL,
  	\`primary_cta_url\` text DEFAULT '/engagement-model/' NOT NULL,
  	\`back_links_portfolio\` text DEFAULT '← Back to Portfolio',
  	\`back_links_insights\` text DEFAULT '← Back to Insights',
  	\`back_links_capabilities\` text DEFAULT '← Back to Capabilities',
  	\`empty_states_no_projects\` text DEFAULT 'No projects available yet.',
  	\`empty_states_no_insights\` text DEFAULT 'No insights available yet.',
  	\`list_labels_view_project_cta\` text DEFAULT 'View Project →',
  	\`list_labels_read_article_cta\` text DEFAULT 'Read Article →',
  	\`list_labels_view_details_cta\` text DEFAULT 'View Details →',
  	\`checklist_ui_items_heading\` text DEFAULT 'Checklist Items',
  	\`checklist_ui_locked_items_suffix_template\` text DEFAULT '+ {count} more items locked (submit form to unlock)',
  	\`checklist_ui_download_prompt\` text DEFAULT 'Download the full checklist with all items:',
  	\`checklist_ui_get_full_checklist_cta\` text DEFAULT 'Get Full Checklist',
  	\`checklist_modal_title\` text DEFAULT 'What do you need help with?',
  	\`checklist_modal_subtitle\` text DEFAULT 'Choose the area to continue with the appropriate checklist',
  	\`checklist_modal_continue_cta\` text DEFAULT 'Continue',
  	\`not_found_heading\` text DEFAULT 'Page Not Found',
  	\`not_found_body\` text DEFAULT 'The page you are looking for does not exist.',
  	\`not_found_cta_label\` text DEFAULT 'Return to Home',
  	\`not_found_cta_url\` text DEFAULT '/',
  	\`nav_fallback_logo_text\` text DEFAULT 'Canopy',
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`DROP TABLE \`users_sessions\`;`)
  await db.run(sql`DROP TABLE \`users\`;`)
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
  await db.run(sql`CREATE TABLE \`__new_payload_preferences_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`user_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_preferences\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_preferences_rels\`("id", "order", "parent_id", "path", "user_id") SELECT "id", "order", "parent_id", "path", "user_id" FROM \`payload_preferences_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_preferences_rels\` RENAME TO \`payload_preferences_rels\`;`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_order_idx\` ON \`payload_preferences_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_parent_idx\` ON \`payload_preferences_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_path_idx\` ON \`payload_preferences_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_user_id_idx\` ON \`payload_preferences_rels\` (\`user_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`users_sessions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`created_at\` text,
  	\`expires_at\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`users_sessions_order_idx\` ON \`users_sessions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`users_sessions_parent_id_idx\` ON \`users_sessions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`users\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`email\` text NOT NULL,
  	\`reset_password_token\` text,
  	\`reset_password_expiration\` text,
  	\`salt\` text,
  	\`hash\` text,
  	\`login_attempts\` numeric DEFAULT 0,
  	\`lock_until\` text
  );
  `)
  await db.run(sql`CREATE INDEX \`users_updated_at_idx\` ON \`users\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`users_created_at_idx\` ON \`users\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`users_email_idx\` ON \`users\` (\`email\`);`)
  await db.run(sql`DROP TABLE \`user_sessions\`;`)
  await db.run(sql`DROP TABLE \`user\`;`)
  await db.run(sql`DROP TABLE \`page_pills\`;`)
  await db.run(sql`DROP TABLE \`page_faqs\`;`)
  await db.run(sql`DROP TABLE \`page_workflow_steps\`;`)
  await db.run(sql`DROP TABLE \`page_team_members\`;`)
  await db.run(sql`DROP TABLE \`page_company_facts_sectors\`;`)
  await db.run(sql`DROP TABLE \`page\`;`)
  await db.run(sql`DROP TABLE \`page_rels\`;`)
  await db.run(sql`DROP TABLE \`_page_v_version_pills\`;`)
  await db.run(sql`DROP TABLE \`_page_v_version_faqs\`;`)
  await db.run(sql`DROP TABLE \`_page_v_version_workflow_steps\`;`)
  await db.run(sql`DROP TABLE \`_page_v_version_team_members\`;`)
  await db.run(sql`DROP TABLE \`_page_v_version_company_facts_sectors\`;`)
  await db.run(sql`DROP TABLE \`_page_v\`;`)
  await db.run(sql`DROP TABLE \`_page_v_rels\`;`)
  await db.run(sql`DROP TABLE \`section\`;`)
  await db.run(sql`DROP TABLE \`section_rels\`;`)
  await db.run(sql`DROP TABLE \`card\`;`)
  await db.run(sql`DROP TABLE \`case_study_images_page_images\`;`)
  await db.run(sql`DROP TABLE \`case_study_at_a_glance\`;`)
  await db.run(sql`DROP TABLE \`case_study_features\`;`)
  await db.run(sql`DROP TABLE \`case_study_technical_specifications\`;`)
  await db.run(sql`DROP TABLE \`case_study\`;`)
  await db.run(sql`DROP TABLE \`_case_study_v_version_images_page_images\`;`)
  await db.run(sql`DROP TABLE \`_case_study_v_version_at_a_glance\`;`)
  await db.run(sql`DROP TABLE \`_case_study_v_version_features\`;`)
  await db.run(sql`DROP TABLE \`_case_study_v_version_technical_specifications\`;`)
  await db.run(sql`DROP TABLE \`_case_study_v\`;`)
  await db.run(sql`DROP TABLE \`blog_tags\`;`)
  await db.run(sql`DROP TABLE \`blog_related_links\`;`)
  await db.run(sql`DROP TABLE \`blog\`;`)
  await db.run(sql`DROP TABLE \`_blog_v_version_tags\`;`)
  await db.run(sql`DROP TABLE \`_blog_v_version_related_links\`;`)
  await db.run(sql`DROP TABLE \`_blog_v\`;`)
  await db.run(sql`DROP TABLE \`checklist_visible_items\`;`)
  await db.run(sql`DROP TABLE \`checklist\`;`)
  await db.run(sql`DROP TABLE \`_checklist_v_version_visible_items\`;`)
  await db.run(sql`DROP TABLE \`_checklist_v\`;`)
  await db.run(sql`DROP TABLE \`payload_kv\`;`)
  await db.run(sql`DROP TABLE \`header\`;`)
  await db.run(sql`DROP TABLE \`footer\`;`)
  await db.run(sql`DROP TABLE \`seo_settings_default_keywords\`;`)
  await db.run(sql`DROP TABLE \`seo_settings_disallow_paths\`;`)
  await db.run(sql`DROP TABLE \`seo_settings\`;`)
  await db.run(sql`DROP TABLE \`site_chrome_checklist_modal_fallback_categories\`;`)
  await db.run(sql`DROP TABLE \`site_chrome\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	\`media_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "users_id", "media_id") SELECT "id", "order", "parent_id", "path", "users_id", "media_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`__new_payload_preferences_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_preferences\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_preferences_rels\`("id", "order", "parent_id", "path", "users_id") SELECT "id", "order", "parent_id", "path", "users_id" FROM \`payload_preferences_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_preferences_rels\` RENAME TO \`payload_preferences_rels\`;`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_order_idx\` ON \`payload_preferences_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_parent_idx\` ON \`payload_preferences_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_path_idx\` ON \`payload_preferences_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_users_id_idx\` ON \`payload_preferences_rels\` (\`users_id\`);`)
}

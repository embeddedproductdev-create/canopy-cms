import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-d1-sqlite'

const q = (value: string): string => `'${value.replace(/'/g, "''")}'`

const textNode = (text: string) => ({ type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text, version: 1 })

const bulletList = (items: string[]) => ({
  root: {
    type: 'root',
    children: [
      {
        type: 'list',
        listType: 'bullet',
        tag: 'ul',
        start: 1,
        children: items.map((item, index) => ({
          type: 'listitem',
          value: index + 1,
          children: [textNode(item)],
          direction: null as string | null,
          format: '',
          indent: 0,
          version: 1,
        })),
        direction: null as string | null,
        format: '',
        indent: 0,
        version: 1,
      },
    ],
    direction: null as string | null,
    format: '',
    indent: 0,
    version: 1,
  },
})

export const howWeWork: Record<string, string[]> = {
  'Discover & Scope': ['Lock scope with you after kickoff', 'Map hardware, firmware, mechanical and software needs', 'Flag risks and costs early'],
  'Design & Build': ['All disciplines work in parallel', 'Peer reviews before layout and fabrication', 'One team, no handoffs'],
  'Validate & Deploy': ['Bring-up and hardware-in-the-loop testing', 'Certification pre-checks', 'Prototypes built with Indian manufacturing partners'],
}

export function buildHowWeWork(): string[] {
  return Object.entries(howWeWork).map(
    ([title, items]) =>
      `UPDATE "card" SET "description" = ${q(JSON.stringify(bulletList(items)))} WHERE "title" = ${q(title)} AND "id" IN (SELECT "card_id" FROM "section_rels" WHERE "card_id" IS NOT NULL AND "parent_id" IN (SELECT "id" FROM "section" WHERE "type" = 'steps' AND "variant" LIKE '%hover%'))`,
  )
}

export async function applyHowWeWork(db: MigrateUpArgs['db']): Promise<void> {
  for (const statement of buildHowWeWork()) await db.run(sql.raw(statement))
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await applyHowWeWork(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  void db
}

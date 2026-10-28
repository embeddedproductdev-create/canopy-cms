import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-d1-sqlite'
import { sql } from '@payloadcms/db-d1-sqlite'

// Payload 3.92 stores when a password reset was last requested on each user.
const columns = [{ table: 'user', name: 'reset_password_requested_at', definition: 'text' }]

type Row = Record<string, unknown>
export type Reader = (query: string) => Promise<Row[]>

/** The SQL this migration needs, so it can run through Payload or straight against D1 with wrangler. */
export async function buildPayload392Columns(read: Reader): Promise<string[]> {
  const statements: string[] = []
  for (const column of columns) {
    const exists = await read(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${column.table}'`)
    if (!exists.length) continue
    const present = await read(`SELECT name FROM pragma_table_info('${column.table}')`)
    if (present.some((row) => row.name === column.name)) continue
    statements.push(`ALTER TABLE "${column.table}" ADD COLUMN "${column.name}" ${column.definition}`)
  }
  return statements
}

export async function applyPayload392Columns(db: MigrateUpArgs['db']): Promise<void> {
  const read: Reader = async (query) => (await db.all(sql.raw(query))) as Row[]
  for (const statement of await buildPayload392Columns(read)) await db.run(sql.raw(statement))
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await applyPayload392Columns(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  void db
}

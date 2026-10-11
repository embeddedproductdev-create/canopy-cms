/**
 * Dev helper: reports (and with --apply adds) columns that exist in the Payload
 * schema but are missing from the local D1 database, e.g. after the database
 * was created by an older push. Additive only — never drops or alters anything.
 *
 *   node --import=tsx/esm scripts/sync-missing-schema.ts           # report only
 *   node --import=tsx/esm scripts/sync-missing-schema.ts with SYNC_APPLY=1  # add columns
 */
import config from '../src/payload.config'
import { getPayload } from 'payload'
import { sql } from '@payloadcms/db-d1-sqlite'

const apply = process.env.SYNC_APPLY === '1'
const payload = await getPayload({ config })
const db = payload.db.drizzle as any
const tables = (payload.db as any).tables as Record<string, any>

const SQLITE = Symbol.for('drizzle:Name')
let missingTables = 0
let missingColumns = 0

for (const table of Object.values(tables)) {
  const name: string | undefined = table?.[SQLITE]
  if (!name) continue
  const existing = (await db.all(sql.raw(`PRAGMA table_info("${name}")`))) as { name: string }[]
  if (existing.length === 0) {
    missingTables++
    console.log(`MISSING TABLE ${name}`)
    continue
  }
  const have = new Set(existing.map((c) => c.name))
  for (const column of Object.values<any>(table)) {
    if (!column || typeof column !== 'object' || typeof column.name !== 'string') continue
    if (typeof column.getSQLType !== 'function' || have.has(column.name)) continue
    missingColumns++
    const type = column.getSQLType()
    console.log(`MISSING COLUMN ${name}.${column.name} (${type})${apply ? ' -> adding' : ''}`)
    if (apply) await db.run(sql.raw(`ALTER TABLE "${name}" ADD COLUMN "${column.name}" ${type}`))
  }
}

console.log(`\n${missingTables} missing tables, ${missingColumns} missing columns${apply ? ' (columns added)' : ''}`)
await new Promise((resolve) => setTimeout(resolve, 3000))
process.exit(0)

import fs from 'fs'
import path from 'path'
import { getPayload } from 'payload'
import { getTableConfig } from 'drizzle-orm/sqlite-core'
import config from '../src/payload.config'

// Writes every table and column Payload expects to scripts/lib/expected-schema.json. `npm run verify:remote` compares
// the live database against it before a deploy, so a database that was not migrated fails the workflow instead of
// shipping an admin whose lists are blank. Rerun after changing any collection or global.
const payload = await getPayload({ config: await config })
const tables = payload.db.tables as unknown as Record<string, Parameters<typeof getTableConfig>[0]>
const schema = Object.fromEntries(
  Object.values(tables)
    .map((table) => getTableConfig(table))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ name, columns }) => [name, columns.map((column) => column.name)]),
)
const file = path.resolve('scripts/lib/expected-schema.json')
fs.writeFileSync(file, JSON.stringify(schema, null, 1) + '\n')
console.log(`Wrote ${Object.keys(schema).length} tables to ${path.relative(process.cwd(), file)}`)
process.exit(0)

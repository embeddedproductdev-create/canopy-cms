import type { Reader } from './20261012_120000_section_card_cleanup'

export const VERSIONED_COLLECTIONS = ['page', 'blog', 'case_study', 'checklist'] as const

type Info = { name: string; type: string }

const q = (value: unknown): string => `'${String(value ?? '').replace(/'/g, "''")}'`

const cache = new WeakMap<Reader, Map<string, Promise<unknown>>>()

function memo<T>(read: Reader, key: string, load: () => Promise<T>): Promise<T> {
  let store = cache.get(read)
  if (!store) {
    store = new Map()
    cache.set(read, store)
  }
  if (!store.has(key)) store.set(key, load())
  return store.get(key) as Promise<T>
}

async function columnsOf(read: Reader, table: string): Promise<string[]> {
  return memo(read, `cols:${table}`, async () => ((await read(`PRAGMA table_info("${table}")`)) as unknown as Info[]).map((c) => String(c.name)))
}

async function tableExists(read: Reader, table: string): Promise<boolean> {
  return memo(read, `exists:${table}`, async () => (await read(`SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ${q(table)}`)).length > 0)
}

async function parentOf(read: Reader, table: string): Promise<string | null> {
  return memo(read, `parent:${table}`, async () => {
    const fks = await read(`PRAGMA foreign_key_list("${table}")`)
    const link = fks.find((fk) => String(fk.from) === '_parent_id')
    return link ? String(link.table) : null
  })
}

export async function deleteVersionsOf(read: Reader, collection: string, parentIds: number[]): Promise<string[]> {
  if (!parentIds.length || !(await tableExists(read, `_${collection}_v`))) return []
  const ids = parentIds.join(', ')
  const versionTable = `_${collection}_v`
  const tables = (await read(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '${versionTable.replace(/_/g, '\\_')}\\_%' ESCAPE '\\'`)).map((r) => String(r.name))
  const depth = async (table: string): Promise<number> => {
    let level = 0
    let current: string | null = table
    while (current && current !== versionTable) {
      current = await parentOf(read, current)
      level++
      if (level > 6) break
    }
    return level
  }
  const withDepth = await Promise.all(tables.map(async (table) => ({ table, level: await depth(table) })))
  withDepth.sort((a, b) => b.level - a.level)
  const statements: string[] = []
  for (const { table } of withDepth) {
    const chain: string[] = []
    let current: string | null = table
    while (current && current !== versionTable) {
      chain.push(current)
      current = await parentOf(read, current)
    }
    if (current !== versionTable && table.endsWith('_rels')) {
      statements.push(`DELETE FROM "${table}" WHERE "parent_id" IN (SELECT "id" FROM "${versionTable}" WHERE "parent_id" IN (${ids}))`)
      continue
    }
    let condition = `"_parent_id" IN (SELECT "id" FROM "${versionTable}" WHERE "parent_id" IN (${ids}))`
    for (let i = chain.length - 1; i >= 1; i--) {
      condition = `"_parent_id" IN (SELECT "id" FROM "${chain[i]}" WHERE ${condition})`
    }
    statements.push(`DELETE FROM "${table}" WHERE ${condition}`)
  }
  statements.push(`DELETE FROM "${versionTable}" WHERE "parent_id" IN (${ids})`)
  return statements
}

export async function buildVersionSnapshots(read: Reader, collection: string, parentIds: number[], startId: number): Promise<string[]> {
  const versionTable = `_${collection}_v`
  const mainCols = await columnsOf(read, collection)
  const versionCols = new Set(await columnsOf(read, versionTable))
  const statements: string[] = []
  const now = new Date().toISOString()

  const mainChildren = (await read(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '${collection.replace(/_/g, '\\_')}\\_%' ESCAPE '\\'`)).map((r) => String(r.name))
  const direct: string[] = []
  const nested: { table: string; parent: string }[] = []
  for (const table of mainChildren) {
    if (table.endsWith('_rels')) continue
    const parent = await parentOf(read, table)
    if (parent === collection) direct.push(table)
    else if (parent && mainChildren.includes(parent)) nested.push({ table, parent })
  }

  let versionId = startId
  for (const parentId of parentIds) {
    versionId += 1
    const copied = mainCols.filter((c) => !['id', 'created_at', 'updated_at', '_status'].includes(c) && versionCols.has(`version_${c}`))
    const columns = ['parent_id', ...copied.map((c) => `version_${c}`), 'version_created_at', 'version_updated_at', 'version__status', 'created_at', 'updated_at', 'latest', 'id']
    const values = [String(parentId), ...copied.map((c) => `"${c}"`), '"created_at"', '"updated_at"', `coalesce("_status", 'published')`, q(now), q(now), '1', String(versionId)]
    statements.push(
      `INSERT INTO "${versionTable}" (${columns.map((c) => `"${c}"`).join(', ')}) SELECT ${values.join(', ')} FROM "${collection}" WHERE "id" = ${parentId}`,
    )

    for (const table of direct) {
      const target = `_${collection}_v_version_${table.slice(collection.length + 1)}`
      if (!(await tableExists(read, target))) continue
      const targetCols = new Set(await columnsOf(read, target))
      const common = (await columnsOf(read, table)).filter((c) => !['_order', '_parent_id', 'id'].includes(c) && targetCols.has(c))
      const uuid = targetCols.has('_uuid') ? ', "_uuid"' : ''
      const uuidValue = targetCols.has('_uuid') ? ", lower(hex(randomblob(12)))" : ''
      statements.push(
        `INSERT INTO "${target}" ("_order", "_parent_id"${common.map((c) => `, "${c}"`).join('')}${uuid}) SELECT "_order", ${versionId}${common.map((c) => `, "${c}"`).join('')}${uuidValue} FROM "${table}" WHERE "_parent_id" = ${parentId}`,
      )
    }
    for (const { table, parent } of nested) {
      const target = `_${collection}_v_version_${table.slice(collection.length + 1)}`
      const targetParent = `_${collection}_v_version_${parent.slice(collection.length + 1)}`
      if (!(await tableExists(read, target)) || !(await tableExists(read, targetParent))) continue
      const targetCols = new Set(await columnsOf(read, target))
      const common = (await columnsOf(read, table)).filter((c) => !['_order', '_parent_id', 'id'].includes(c) && targetCols.has(c))
      const uuid = targetCols.has('_uuid') ? ', "_uuid"' : ''
      const uuidValue = targetCols.has('_uuid') ? ", lower(hex(randomblob(12)))" : ''
      statements.push(
        `INSERT INTO "${target}" ("_order", "_parent_id"${common.map((c) => `, "${c}"`).join('')}${uuid}) SELECT r."_order", (SELECT v."id" FROM "${targetParent}" v WHERE v."_parent_id" = ${versionId} AND v."_order" = g."_order"), ${common.map((c) => `r."${c}"`).join(', ')}${uuidValue} FROM "${table}" r JOIN "${parent}" g ON g."id" = r."_parent_id" WHERE g."_parent_id" = ${parentId}`.replace(', , ', ', '),
      )
    }

    const relsTable = `${collection}_rels`
    const versionRels = `_${collection}_v_rels`
    if ((await tableExists(read, relsTable)) && (await tableExists(read, versionRels))) {
      const targetCols = new Set(await columnsOf(read, versionRels))
      const common = (await columnsOf(read, relsTable)).filter((c) => !['id', 'order', 'parent_id', 'path'].includes(c) && targetCols.has(c))
      statements.push(
        `INSERT INTO "${versionRels}" ("order", "parent_id", "path"${common.map((c) => `, "${c}"`).join('')}) SELECT "order", ${versionId}, 'version.' || "path"${common.map((c) => `, "${c}"`).join('')} FROM "${relsTable}" WHERE "parent_id" = ${parentId}`,
      )
    }
  }
  return statements
}

export async function buildVersionRepair(read: Reader, options: { replace?: Record<string, number[]> } = {}): Promise<string[]> {
  const statements: string[] = []
  for (const collection of VERSIONED_COLLECTIONS) {
    const versionTable = `_${collection}_v`
    if (!(await tableExists(read, collection)) || !(await tableExists(read, versionTable))) continue
    const replace = options.replace?.[collection] ?? []
    const missing = (
      await read(`SELECT p."id" AS id FROM "${collection}" p WHERE NOT EXISTS (SELECT 1 FROM "${versionTable}" v WHERE v."parent_id" = p."id" AND v."latest" = 1)`)
    ).map((r) => Number(r.id))
    const targets = [...new Set([...missing, ...replace])]
    if (!targets.length) continue
    statements.push(...(await deleteVersionsOf(read, collection, targets)))
    const maxId = Number((await read(`SELECT coalesce(max("id"), 0) AS n FROM "${versionTable}"`))[0]?.n ?? 0)
    statements.push(...(await buildVersionSnapshots(read, collection, targets, maxId)))
  }
  return statements
}

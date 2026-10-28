import type { Field } from 'payload'

const nameOf = (field: Field): string | undefined => ('name' in field ? field.name : undefined)

/** Repeating lists start collapsed so a long form stays scannable; everything else stays open. */
export function collapseArrays(field: Field): Field {
  if (field.type === 'group') return { ...field, fields: field.fields.map(collapseArrays) }
  if (field.type !== 'array') return field
  return { ...field, admin: { ...field.admin, initCollapsed: true }, fields: field.fields.map(collapseArrays) }
}

/** The fields called `names` from a shared list, in the order given. */
export function pick(fields: Field[], ...names: string[]): Field[] {
  return names.map((name) => {
    const found = fields.find((field) => nameOf(field) === name)
    if (!found) throw new Error(`pick: no field named "${name}"`)
    return found
  })
}

/** One titled section of a form, stored as a Payload group (its fields live under `name`). */
export const section = (name: string, label: string, fields: Field[]): Field => ({
  name,
  type: 'group',
  label,
  fields: fields.map(collapseArrays),
})

import type { FieldHook } from 'payload'

export function shouldRedact(item: { locked?: unknown } | undefined, hasUser: boolean): boolean {
  return item?.locked === true && !hasUser
}

export const redactLockedItem: FieldHook = ({ value, siblingData, req }) =>
  shouldRedact(siblingData as { locked?: unknown } | undefined, !!req?.user) ? '' : value

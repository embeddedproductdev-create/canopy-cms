import type { FieldHook } from 'payload'

/**
 * Locked checklist items (4–10) are authored in the CMS but must never reach the
 * public website. On read, an item's text is replaced by an empty string unless
 * the request is made by an authenticated CMS user.
 */
export function shouldRedact(item: { locked?: unknown } | undefined, hasUser: boolean): boolean {
  return item?.locked === true && !hasUser
}

export const redactLockedItem: FieldHook = ({ value, siblingData, req }) =>
  shouldRedact(siblingData as { locked?: unknown } | undefined, !!req?.user) ? '' : value

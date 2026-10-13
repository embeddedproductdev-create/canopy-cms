import type { FieldHook } from 'payload'

const EMAIL = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/
const PHONE = /^\+?[\d\s().-]{7,}$/

export function normalizeUrlValue<T>(value: T): T | string {
  if (typeof value !== 'string') return value
  const url = value.trim()
  if (!url) return url
  if (/^(https?:\/\/|\/|#|mailto:|tel:)/i.test(url)) return url
  if (EMAIL.test(url)) return `mailto:${url}`
  if (PHONE.test(url)) return `tel:${url.replace(/[^\d+]/g, '')}`
  if (/^www\./i.test(url)) return `https://${url}`
  return url
}

export const normalizeUrl: FieldHook = ({ value }) => normalizeUrlValue(value)

export const urlField = {
  hooks: { beforeValidate: [normalizeUrl] },
}

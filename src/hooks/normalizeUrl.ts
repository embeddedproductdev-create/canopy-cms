import type { FieldHook } from 'payload'

const EMAIL = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/
const PHONE = /^\+?[\d\s().-]{7,}$/

/**
 * Canonicalises a CTA / link value so editors can type it naturally:
 *   https://…  /path  #anchor  mailto:…  tel:…  -> unchanged
 *   name@host.tld                               -> mailto:name@host.tld
 *   +91 98765 43210                              -> tel:+919876543210
 *   www.example.com                              -> https://www.example.com
 * Anything else is returned trimmed and untouched.
 */
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

/** Spread into a text field definition: `{ name: 'href', type: 'text', ...urlField }`. */
export const urlField = {
  hooks: { beforeValidate: [normalizeUrl] },
  admin: {
    description: 'https://… opens in a new tab · /page stays in the site · name@host adds mailto: · +91… adds tel:',
  },
}

export const formatSlug = (val: string): string =>
  val
    ? val
        .toLowerCase()
        .replace(/ /g, '-')
        .replace(/[^\w-]+/g, '')
    : ''

// Like formatSlug, but preserves the "/" path separators — for full URL
// path fields (e.g. Page.url) as opposed to single-segment slug fields.
export const formatUrlPath = (val: string): string => {
  if (!val) return val
  if (val === '/') return '/'
  const segments = val.split('/').filter(Boolean).map(formatSlug)
  return `/${segments.join('/')}/`
}

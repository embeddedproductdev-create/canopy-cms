export const formatSlug = (val: string): string =>
  val
    ? val
        .toLowerCase()
        .replace(/ /g, '-')
        .replace(/[^\w-]+/g, '')
    : ''

export const formatUrlPath = (val: string): string => {
  if (!val) return val
  if (val === '/') return '/'
  const segments = val.split('/').filter(Boolean).map(formatSlug)
  return `/${segments.join('/')}/`
}

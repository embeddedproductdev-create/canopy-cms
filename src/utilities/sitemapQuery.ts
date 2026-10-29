/** The sitemap only needs a URL, a modified date and the SEO group, so nothing else is loaded or populated. */
export const sitemapQuery = {
  limit: 500,
  depth: 0,
  pagination: false,
  select: { url: true, slug: true, updatedAt: true, seo: true },
} as const

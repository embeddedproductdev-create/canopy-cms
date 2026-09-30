import { getPayload } from 'payload'
import config from '../../payload.config'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.canopyembedded.com'
const ITEMS_PER_PAGE = 7

interface SitemapEntry {
  url: string
  lastmod?: string
  changefreq: string
  priority: number
}

export async function GET() {
  try {
    const payload = await getPayload({ config })

    const entries: SitemapEntry[] = []

    // Static routes
    entries.push(
      { url: '/', changefreq: 'weekly', priority: 1.0 },
      { url: '/about/', changefreq: 'monthly', priority: 0.8 },
      { url: '/work/', changefreq: 'weekly', priority: 0.9 },
      { url: '/capabilities/', changefreq: 'monthly', priority: 0.9 },
      { url: '/engagement-model/', changefreq: 'monthly', priority: 0.8 },
      { url: '/insights/', changefreq: 'weekly', priority: 0.8 },
    )

    // Fetch published pages
    const pagesResult = await payload.find({
      collection: 'page',
      limit: 1000,
      depth: 0,
    })

    for (const page of pagesResult.docs as any[]) {
      if (page.url && page.url !== '/') {
        entries.push({
          url: page.url,
          lastmod: page.updatedAt,
          changefreq: 'monthly',
          priority: 0.8,
        })
      }
    }

    // Fetch published case studies
    const projectsResult = await payload.find({
      collection: 'case-study',
      limit: 1000,
      depth: 0,
    })

    for (const project of projectsResult.docs as any[]) {
      if (project.slug) {
        entries.push({
          url: `/work/${project.slug}/`,
          lastmod: project.updatedAt,
          changefreq: 'monthly',
          priority: 0.7,
        })
      }
    }

    // Fetch published blogs
    const postsResult = await payload.find({
      collection: 'blog',
      limit: 1000,
      depth: 0,
    })

    const totalPosts = postsResult.totalDocs
    const totalPages = Math.ceil(totalPosts / ITEMS_PER_PAGE)

    // Add pagination pages
    for (let page = 1; page <= totalPages; page++) {
      entries.push({
        url: `/insights/page/${page}/`,
        changefreq: 'weekly',
        priority: 0.6,
      })
    }

    // Add individual posts
    for (const post of postsResult.docs as any[]) {
      if (post.slug) {
        entries.push({
          url: `/insights/${post.slug}/`,
          lastmod: post.updatedAt,
          changefreq: 'monthly',
          priority: 0.6,
        })
      }
    }

    // Fetch published checklists
    const checklistsResult = await payload.find({
      collection: 'checklist',
      limit: 1000,
      depth: 0,
    })

    for (const checklist of checklistsResult.docs as any[]) {
      if (checklist.slug) {
        entries.push({
          url: `/resources/${checklist.slug}/`,
          lastmod: checklist.updatedAt,
          changefreq: 'monthly',
          priority: 0.7,
        })
      }
    }

    // Remove duplicates
    const seen = new Set<string>()
    const uniqueEntries = entries.filter((entry) => {
      if (seen.has(entry.url)) return false
      seen.add(entry.url)
      return true
    })

    // Generate XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniqueEntries
  .map(
    (entry) => `  <url>
    <loc>${SITE_URL}${entry.url}</loc>
${entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : ''}
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch (error) {
    console.error('[sitemap.xml] Generation failed:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

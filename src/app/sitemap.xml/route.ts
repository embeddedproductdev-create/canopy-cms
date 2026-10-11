import { getPayload } from 'payload'
import config from '../../payload.config'

interface Entry {
  url: string
  lastmod?: string
}

/** Sitemap of every published, indexable page. The host comes from SEO Settings (Site URL). */
export async function GET() {
  try {
    const payload = await getPayload({ config })
    const settings = (await payload.findGlobal({ slug: 'seo-settings', depth: 0 })) as { siteUrl?: string; allowIndexing?: boolean }
    const siteUrl = (settings.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')

    const entries: Entry[] = []
    const add = async (collection: string, toUrl: (doc: any) => string | null) => {
      const result = await payload.find({ collection: collection as never, limit: 1000, depth: 0, pagination: false })
      for (const doc of result.docs as any[]) {
        if (doc.seo?.robots?.index === false) continue
        const url = toUrl(doc)
        if (url) entries.push({ url: doc.seo?.canonicalUrl || url, lastmod: doc.updatedAt })
      }
    }

    await add('page', (doc) => doc.url ?? null)
    await add('capability', (doc) => (doc.slug ? `/capabilities/${doc.slug}/` : null))
    await add('industry', (doc) => (doc.slug ? `/industries/${doc.slug}/` : null))
    await add('case-study', (doc) => (doc.slug ? `/work/${doc.slug}/` : null))
    await add('blog', (doc) => (doc.slug ? `/insights/${doc.slug}/` : null))
    await add('checklist', (doc) => (doc.slug ? `/resources/${doc.slug}/` : null))

    const seen = new Set<string>()
    const unique = settings.allowIndexing === false ? [] : entries.filter((entry) => !seen.has(entry.url) && seen.add(entry.url))
    const absolute = (url: string) => (/^https?:\/\//i.test(url) ? url : `${siteUrl}${url}`)

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${unique.map((entry) => `  <url>\n    <loc>${absolute(entry.url)}</loc>${entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : ''}\n  </url>`).join('\n')}
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

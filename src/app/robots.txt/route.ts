import { getPayload } from 'payload'
import config from '../../payload.config'

export async function GET() {
  try {
    const payload = await getPayload({ config })

    const seoSettings = await payload.findGlobal({
      slug: 'seo-settings',
      depth: 0,
    })

    const { allowIndexing = true, sitemapUrl = '', disallowPaths = [] } = seoSettings

    let robotsContent = ''

    robotsContent += 'User-Agent: *\n'

    if (!allowIndexing) {
      robotsContent += 'Disallow: /\n'
    } else {
      if (Array.isArray(disallowPaths)) {
        for (const entry of disallowPaths) {
          if (typeof entry === 'string' && entry) robotsContent += `Disallow: ${entry}\n`
        }
      }
    }

    if (sitemapUrl) {
      robotsContent += `\nSitemap: ${sitemapUrl}\n`
    }

    return new Response(robotsContent, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch (error) {
    console.error('[robots.txt] Generation failed:', error)

    const defaultRobots = `User-Agent: *
Allow: /
Sitemap: https://www.canopyembedded.com/sitemap.xml
`
    return new Response(defaultRobots, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  }
}

import { getPayload } from 'payload'
import config from '../../payload.config'

export async function GET() {
  try {
    const payload = await getPayload({ config })

    // Fetch SEO settings
    const seoSettings = await payload.findGlobal({
      slug: 'seo-settings',
      depth: 0,
    })

    const { allowIndexing = true, sitemapUrl = '', disallowPaths = [] } = seoSettings

    let robotsContent = ''

    // User-Agent for all bots
    robotsContent += 'User-Agent: *\n'

    if (!allowIndexing) {
      robotsContent += 'Disallow: /\n'
    } else {
      // Add disallowed paths if indexing is allowed
      if (Array.isArray(disallowPaths) && disallowPaths.length > 0) {
        for (const pathObj of disallowPaths) {
          if (pathObj && 'path' in pathObj) {
            robotsContent += `Disallow: ${pathObj.path}\n`
          }
        }
      }
    }

    // Add sitemap
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

    // Return a default robots.txt on error
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

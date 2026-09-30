import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, GlobalAfterChangeHook } from 'payload'

const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || ''
const CLOUDFLARE_AUTH_TOKEN = process.env.CLOUDFLARE_AUTH_TOKEN || ''
const DEPLOY_HOOK_URL = process.env.DEPLOY_HOOK_URL || ''

async function purgeCloudflareCache(urls: string[]): Promise<void> {
  if (!CLOUDFLARE_ZONE_ID || !CLOUDFLARE_AUTH_TOKEN) {
    console.warn('[revalidate] Cloudflare credentials not configured; skipping cache purge')
    return
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: urls }),
      },
    )

    if (!response.ok) {
      const error = await response.text()
      console.error(`[revalidate] Cloudflare purge failed: ${response.status} ${error}`)
      return
    }

    console.log(`[revalidate] Purged ${urls.length} URL(s) from Cloudflare cache`)
  } catch (error) {
    console.error('[revalidate] Cloudflare purge error:', error)
  }
}

async function triggerDeployHook(): Promise<void> {
  if (!DEPLOY_HOOK_URL) {
    console.warn('[revalidate] Deploy hook URL not configured; skipping rebuild trigger')
    return
  }

  try {
    const response = await fetch(DEPLOY_HOOK_URL, { method: 'POST' })
    if (!response.ok) {
      console.error(`[revalidate] Deploy hook failed: ${response.status}`)
      return
    }
    console.log('[revalidate] Deploy hook triggered successfully')
  } catch (error) {
    console.error('[revalidate] Deploy hook error:', error)
  }
}

export const revalidateOnChange: CollectionAfterChangeHook = async ({ doc, req }) => {
  // Purge API routes and sitemap/robots from Cloudflare cache
  const baseUrl = process.env.PAYLOAD_PUBLIC_URL || 'https://www.canopyembedded.com'
  const urlsToPurge = [
    `${baseUrl}/api/pages*`,
    `${baseUrl}/api/posts*`,
    `${baseUrl}/api/projects*`,
    `${baseUrl}/api/checklists*`,
    `${baseUrl}/api/categories*`,
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/robots.txt`,
  ]

  await purgeCloudflareCache(urlsToPurge)

  // Trigger the website rebuild
  await triggerDeployHook()

  return doc
}

export const revalidateOnDelete: CollectionAfterDeleteHook = async ({ doc }) => {
  const baseUrl = process.env.PAYLOAD_PUBLIC_URL || 'https://www.canopyembedded.com'
  const urlsToPurge = [
    `${baseUrl}/api/pages*`,
    `${baseUrl}/api/posts*`,
    `${baseUrl}/api/projects*`,
    `${baseUrl}/api/checklists*`,
    `${baseUrl}/api/categories*`,
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/robots.txt`,
  ]

  await purgeCloudflareCache(urlsToPurge)
  await triggerDeployHook()

  return doc
}

export const revalidateGlobalOnChange: GlobalAfterChangeHook = async ({ doc }) => {
  const baseUrl = process.env.PAYLOAD_PUBLIC_URL || 'https://www.canopyembedded.com'
  const urlsToPurge = [
    `${baseUrl}/api/globals/header`,
    `${baseUrl}/api/globals/footer`,
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/robots.txt`,
  ]

  await purgeCloudflareCache(urlsToPurge)
  await triggerDeployHook()

  return doc
}

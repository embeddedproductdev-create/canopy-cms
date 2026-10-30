type Fetcher = (url: string) => Promise<{ status: number; json: () => Promise<unknown> }>

/** Requests every media file the CMS lists and returns the ones that do not answer 200. */
export async function checkMedia(baseUrl: string, fetcher: Fetcher): Promise<{ checked: number; broken: string[] }> {
  const base = baseUrl.replace(/\/+$/, '')
  const list = await fetcher(`${base}/api/media?limit=200&depth=0`)
  if (list.status !== 200) throw new Error(`GET /api/media -> ${list.status}`)
  const urls = ((await list.json()) as { docs?: { url?: string | null }[] }).docs?.map((doc) => doc.url).filter((url): url is string => !!url) ?? []
  const broken: string[] = []
  for (const url of urls) {
    const response = await fetcher(`${base}${url}`)
    if (response.status !== 200) broken.push(`${url} -> ${response.status}`)
  }
  return { checked: urls.length, broken }
}

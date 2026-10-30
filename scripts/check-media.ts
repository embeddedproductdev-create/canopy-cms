import { checkMedia } from './lib/check-media'

// `npm run check:media`: requests every media file from the deployed CMS (CMS_URL) and fails if any does not load.
const base = String(process.env.CMS_URL ?? '').split(',')[0].trim()
if (!base) throw new Error('Set CMS_URL to the deployed CMS, e.g. https://canopy-cms.example.workers.dev')
const { checked, broken } = await checkMedia(base, async (url) => {
  const response = await fetch(url)
  return { status: response.status, json: () => response.json() }
})
console.log(`Media checked: ${checked}, broken: ${broken.length}`)
for (const line of broken) console.log(`  ${line}`)
if (!checked || broken.length) {
  console.error(checked ? 'Some media files are not served from R2.' : 'The CMS lists no media.')
  process.exit(1)
}

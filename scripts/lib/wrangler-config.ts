import fs from 'fs'
import path from 'path'

export function readWranglerConfig(): {
  name: string
  d1: { binding: string; database_name: string; database_id: string }
  r2: { binding: string; bucket_name: string }
} {
  const raw = fs.readFileSync(path.resolve('wrangler.jsonc'), 'utf8')
  const json = raw
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/,(\s*[}\]])/g, '$1')
  const config = JSON.parse(json)
  return { name: config.name, d1: config.d1_databases[0], r2: config.r2_buckets[0] }
}

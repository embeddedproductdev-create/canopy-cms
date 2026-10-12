import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { readWranglerConfig } from './lib/wrangler-config'

const execute = process.argv.includes('--yes')
const { r2 } = readWranglerConfig()
const dir = path.resolve(process.env.SYNC_MEDIA_DIR ?? 'media')
const TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
}

const files = fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isFile() && !f.startsWith('.'))
const totalMb = files.reduce((sum, f) => sum + fs.statSync(path.join(dir, f)).size, 0) / 1024 / 1024
console.log(`${files.length} file(s), ${totalMb.toFixed(1)} MB  ->  R2 bucket "${r2.bucket_name}"`)

let done = 0
for (const f of files) {
  const type = TYPES[path.extname(f).toLowerCase()] ?? 'application/octet-stream'
  if (!execute) {
    console.log(`  would upload ${f} (${type})`)
    continue
  }
  execFileSync('npx', ['wrangler', 'r2', 'object', 'put', `"${r2.bucket_name}/${f}"`, '--file', `"${path.join(dir, f)}"`, '--content-type', type, '--remote'], { stdio: 'pipe', shell: true })
  done++
  console.log(`  ✓ ${f}`)
}
console.log(execute ? `\nUploaded ${done}/${files.length}.` : '\nDry run only. Re-run with --yes to upload.')

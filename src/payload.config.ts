import fs from 'fs'
import path from 'path'
import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite'
import { EXPERIMENTAL_TableFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import { CloudflareContext, getCloudflareContext } from '@opennextjs/cloudflare'
import { GetPlatformProxyOptions } from 'wrangler'
import { r2Storage } from '@payloadcms/storage-r2'

import { Media } from './collections/Media'
import { Header } from './globals/Header'
import { Footer } from './globals/Footer'
import { SeoSettings } from './globals/SeoSettings'
import { SiteChrome } from './globals/SiteChrome'
import { Page } from './collections/Page'
import { Capability } from './collections/Capability'
import { Industry } from './collections/Industry'
import { Section } from './collections/Section'
import { Card } from './collections/Card'
import { CaseStudy } from './collections/CaseStudy'
import { Blog } from './collections/Blog'
import { Checklist } from './collections/Checklist'
import { Testimonial } from './collections/Testimonial'
import { FormSubmission } from './collections/FormSubmission'
import { User } from './collections/User'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const realpath = (value: string) => (fs.existsSync(value) ? fs.realpathSync(value) : undefined)

const getPayloadSecret = (): string => {
  if (process.env.PAYLOAD_SECRET) {
    const val = process.env.PAYLOAD_SECRET.trim()
    if (val) return val
  }

  try {
    const envPath = path.resolve(dirname, '../.env')
    const content = fs.readFileSync(envPath, 'utf-8')
    const line = content.split('\n').find(l => l.trim().startsWith('PAYLOAD_SECRET='))
    if (line) {
      const secret = line.split('=')[1]?.trim()
      if (secret) return secret
    }
  } catch (e) {
    // Continue to next source
  }

  try {
    const envLocalPath = path.resolve(dirname, '../.env.local')
    const content = fs.readFileSync(envLocalPath, 'utf-8')
    const line = content.split('\n').find(l => l.trim().startsWith('PAYLOAD_SECRET='))
    if (line) {
      const secret = line.split('=')[1]?.trim()
      if (secret) return secret
    }
  } catch (e) {
    // Continue
  }

  return ''
}

const payloadSecret = getPayloadSecret()
if (!payloadSecret && process.env.NODE_ENV === 'production') {
  throw new Error('PAYLOAD_SECRET is not set; refusing to start without it in production.')
}

const isCLI = process.argv.some((value) => realpath(value).replaceAll('\\', '/').endsWith('payload/bin.js'))
const isProduction = process.env.NODE_ENV === 'production'
const useLocalBindings = process.env.PAYLOAD_USE_LOCAL_BINDINGS === 'true'

const createLog =
  (level: string, fn: typeof console.log) => (objOrMsg: object | string, msg?: string) => {
    if (typeof objOrMsg === 'string') {
      fn(JSON.stringify({ level, msg: objOrMsg }))
    } else {
      fn(JSON.stringify({ level, ...objOrMsg, msg: msg ?? (objOrMsg as { msg?: string }).msg }))
    }
  }

const cloudflareLogger = {
  level: process.env.PAYLOAD_LOG_LEVEL || 'info',
  trace: createLog('trace', console.debug),
  debug: createLog('debug', console.debug),
  info: createLog('info', console.log),
  warn: createLog('warn', console.warn),
  error: createLog('error', console.error),
  fatal: createLog('fatal', console.error),
  silent: () => {},
} as any

const cloudflare =
  isCLI || useLocalBindings || !isProduction
    ? await getCloudflareContextFromWrangler()
    : await getCloudflareContext({ async: true })

const allowedOrigins = [
  ...(isProduction ? [] : ['http://localhost:4200', 'http://localhost:3000']),
  'https://canopy-cms.embeddedproductdev.workers.dev',
  'https://canopyembedded.com',
  'https://www.canopyembedded.com',
  'https://canopy-d28.pages.dev',
]

export default buildConfig({
  admin: {
    user: User.slug,
    meta: {
      titleSuffix: ' – Canopy CMS',
      icons: [
        { rel: 'icon', type: 'image/x-icon', url: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '180x180', url: '/brand/icon.png' },
        { rel: 'apple-touch-icon', url: '/brand/icon.png' },
      ],
    },
    components: {
      graphics: { Logo: '/components/admin/Logo', Icon: '/components/admin/Icon' },
      actions: ['/components/admin/NotificationBell'],
    },
    importMap: {
      baseDir: path.resolve(dirname),
      // Only `npm run generate:importmap` writes the map: the dev server and tests load the config without the
      // R2 plugin and would otherwise rewrite the committed file without its R2 entry.
      autoGenerate: false,
    },
  },
  // The Worker has 128 MB of memory and buffers an upload several times over, so large files are refused.
  upload: { limits: { fileSize: 10 * 1024 * 1024 } },
  // The website reads the REST API only; leaving GraphQL out keeps its schema off every cold start.
  graphQL: { disable: true },
  // Deep populates and long lists are what blow the Worker's memory; the site's deepest read is depth 3.
  maxDepth: 3,
  cors: allowedOrigins,
  csrf: allowedOrigins,
  globals: [Header, Footer, SeoSettings, SiteChrome],
  // Admin lists load 25 rows at a time (at most 50) so opening a collection never reads it whole.
  collections: [User, Media, Page, Section, Card, Capability, Industry, CaseStudy, Blog, Checklist, FormSubmission, Testimonial].map(
    (collection) => ({ ...collection, admin: { ...collection.admin, pagination: { defaultLimit: 25, limits: [10, 25, 50] } } }),
  ),
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [...defaultFeatures, EXPERIMENTAL_TableFeature()],
  }),
  secret: payloadSecret,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: sqliteD1Adapter({
    binding: cloudflare.env.D1,
    migrationDir: path.resolve(dirname, 'migrations'),
    push: process.env.PAYLOAD_PUSH === 'true',
  }),
  logger: isProduction ? cloudflareLogger : undefined,
  plugins: [
    ...(isProduction || isCLI
      ? [
          r2Storage({
            bucket: cloudflare.env.R2,
            collections: { media: true },
          }),
        ]
      : []),
  ],
})

function getCloudflareContextFromWrangler(): Promise<CloudflareContext> {
  return import(/* webpackIgnore: true */ `${'__wrangler'.replaceAll('_', '')}`).then(
    ({ getPlatformProxy }) =>
      getPlatformProxy({
        environment: process.env.CLOUDFLARE_ENV,
        remoteBindings: isProduction && !useLocalBindings,
      } satisfies GetPlatformProxyOptions),
  )
}

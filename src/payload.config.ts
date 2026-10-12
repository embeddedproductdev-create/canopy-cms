import fs from 'fs'
import path from 'path'
import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
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

const isCLI = process.argv.some((value) => realpath(value).endsWith(path.join('payload', 'bin.js')))
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
  'http://localhost:4200',
  'http://localhost:3000',
  'https://canopyembedded.com',
  'https://www.canopyembedded.com',
  'https://canopy-d28.pages.dev',
  ...(process.env.FRONTEND_ORIGINS ?? '')
    .split(/[,\s]+/)
    .map((origin) => origin.replace(/^["']+|["']+$/g, '').replace(/\/+$/, ''))
    .filter(Boolean),
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
    },
  },
  cors: allowedOrigins,
  csrf: allowedOrigins,
  globals: [Header, Footer, SeoSettings, SiteChrome],
  collections: [User, Media, Page, Section, Card, Capability, Industry, CaseStudy, Blog, Checklist, FormSubmission, Testimonial],
  editor: lexicalEditor(),
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

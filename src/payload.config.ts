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

// Load PAYLOAD_SECRET from multiple sources
const getPayloadSecret = (): string => {
  // Try environment variable first
  if (process.env.PAYLOAD_SECRET) {
    const val = process.env.PAYLOAD_SECRET.trim()
    if (val) return val
  }

  // Try .env file
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

  // Try .env.local file
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
} as any // Use PayloadLogger type when it's exported

const cloudflare =
  isCLI || !isProduction
    ? await getCloudflareContextFromWrangler()
    : await getCloudflareContext({ async: true })

const allowedOrigins = [
  'http://localhost:4200',
  'http://localhost:3000',
  ...(process.env.FRONTEND_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
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
      // Same logo / icon as the website (files in public/brand).
      graphics: { Logo: '/components/admin/Logo', Icon: '/components/admin/Icon' },
      // Bell icon in the header: form submissions as notifications (right-hand drawer, archive, 60-day purge).
      actions: ['/components/admin/NotificationBell'],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  // Website + CMS origins; add the production site with FRONTEND_ORIGINS=https://www.example.com,https://other
  cors: allowedOrigins,
  csrf: allowedOrigins,
  globals: [Header, Footer, SeoSettings, SiteChrome],
  collections: [User, Media, Page, Section, Card, Capability, Industry, CaseStudy, Blog, Checklist, FormSubmission, Testimonial],
  editor: lexicalEditor(),
  secret: payloadSecret,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  // Schema changes are applied through migrations so development never drops
  // populated legacy tables as part of an interactive schema push.
  db: sqliteD1Adapter({
    binding: cloudflare.env.D1,
    migrationDir: path.resolve(dirname, 'migrations'),
    push: process.env.PAYLOAD_PUSH === 'true',
  }),
  logger: isProduction ? cloudflareLogger : undefined,
  // storage: [
  //   r2Storage({
  //     bucket: cloudflare.env.R2,
  //     collections: { media: true },
  //   }),
  // ],
})

// Adapted from https://github.com/opennextjs/opennextjs-cloudflare/blob/d00b3a13e42e65aad76fba41774815726422cc39/packages/cloudflare/src/api/cloudflare-context.ts#L328C36-L328C46
function getCloudflareContextFromWrangler(): Promise<CloudflareContext> {
  return import(/* webpackIgnore: true */ `${'__wrangler'.replaceAll('_', '')}`).then(
    ({ getPlatformProxy }) =>
      getPlatformProxy({
        environment: process.env.CLOUDFLARE_ENV,
        remoteBindings: isProduction,
      } satisfies GetPlatformProxyOptions),
  )
}

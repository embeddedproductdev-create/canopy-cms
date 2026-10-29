import { withPayload } from '@payloadcms/next/withPayload'

const PUBLIC_COLLECTIONS = ['page', 'case-study', 'blog', 'capability', 'industry', 'testimonial', 'checklist', 'globals'].join('|')

const nextConfig = {
  // Page-data workers each start a local D1 (miniflare) on the same SQLite file during `build:cf`;
  // more than one of them racing for it fails with SQLITE_BUSY, so collect page data in one worker.
  experimental: { cpus: 1 },
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
      // Public reads only: requests carrying the admin login cookie never match, so editors always see fresh data.
      {
        source: `/api/:collection(${PUBLIC_COLLECTIONS})/:path*`,
        missing: [{ type: 'cookie' as const, key: 'payload-token' }],
        headers: [{ key: 'Cache-Control', value: 'public, max-age=60, s-maxage=300, stale-while-revalidate=300' }],
      },
      {
        source: '/api/media/file/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=3600' }],
      },
      {
        source: '/api/form-submission/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
      {
        source: '/api/form-submission',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
    ]
  },
  serverExternalPackages: ['jose', 'pg-cloudflare'],

  webpack: (webpackConfig: any) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })

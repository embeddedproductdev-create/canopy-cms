import { defineCloudflareConfig } from '@opennextjs/cloudflare/config'

// Next 16 builds with Turbopack by default, which mangles externals such as drizzle-kit/api into
// hashed names the OpenNext bundler cannot resolve. Keep the webpack build used until now.
export default {
  ...defineCloudflareConfig({}),
  buildCommand: 'npx next build --webpack',
}

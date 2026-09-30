#!/usr/bin/env node
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { getPayload } from 'payload'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

interface TestResult {
  name: string
  status: 'pass' | 'fail' | 'warn'
  count?: number
  message?: string
}

interface CoverageRow {
  type: string
  name: string
  slug?: string
  status: string
  fields: string[]
}

async function main() {
  let payload: any
  const results: TestResult[] = []
  const coverage: CoverageRow[] = []

  console.log('\n🧪 Canopy CMS Seed & Coverage Test\n')
  console.log('=' .repeat(80))

  try {
    // Load config
    const configUrl = pathToFileURL(path.resolve(dirname, '../src/payload.config.ts')).href
    const configModule = await import(configUrl)
    payload = await getPayload({ config: configModule.default })
    console.log('✓ Connected to Payload\n')
  } catch (error) {
    console.error('✗ Failed to connect to Payload:', error instanceof Error ? error.message : error)
    process.exit(1)
  }

  // ============ Test Globals ============
  console.log('📋 TESTING GLOBALS\n')

  const globals = [
    { slug: 'header', name: 'Header' },
    { slug: 'footer', name: 'Footer' },
    { slug: 'seo-settings', name: 'SEO Settings' },
    { slug: 'site-chrome', name: 'Site Chrome' },
  ]

  for (const global of globals) {
    try {
      const doc = await payload.findGlobal({ slug: global.slug, depth: 0 })
      const fieldCount = Object.keys(doc || {}).length
      results.push({ name: `Global: ${global.name}`, status: 'pass', count: fieldCount })
      console.log(`✓ ${global.name.padEnd(20)} | ${fieldCount} fields`)
      coverage.push({
        type: 'Global',
        name: global.name,
        status: '✓',
        fields: Object.keys(doc || {}).slice(0, 5),
      })
    } catch (error) {
      results.push({
        name: `Global: ${global.name}`,
        status: 'fail',
        message: error instanceof Error ? error.message : String(error),
      })
      console.log(`✗ ${global.name.padEnd(20)} | ${error instanceof Error ? error.message : error}`)
    }
  }

  // ============ Test Collections ============
  console.log('\n📚 TESTING COLLECTIONS\n')

  const collections = [
    { slug: 'page', expectedMin: 0 },
    { slug: 'case-study', expectedMin: 0 },
    { slug: 'blog', expectedMin: 0 },
    { slug: 'checklist', expectedMin: 0 },
    { slug: 'card', expectedMin: 0 },
    { slug: 'section', expectedMin: 0 },
    { slug: 'media', expectedMin: 0 },
  ]

  for (const coll of collections) {
    try {
      const result = await payload.find({
        collection: coll.slug,
        limit: 1000,
        depth: 0,
      })
      const count = result.totalDocs
      const status = count > 0 ? 'pass' : 'warn'
      const symbol = count > 0 ? '✓' : '○'
      results.push({ name: `Collection: ${coll.slug}`, status: status as any, count })
      console.log(`${symbol} ${coll.slug.padEnd(20)} | ${count} documents`)

      // Get sample doc for field inspection
      if (count > 0) {
        const sample = result.docs[0]
        const fields = Object.keys(sample || {}).filter((k) => !k.startsWith('_'))
        coverage.push({
          type: 'Collection',
          name: coll.slug,
          slug: sample?.slug || sample?.url,
          status: '✓',
          fields: fields.slice(0, 8),
        })
      }
    } catch (error) {
      results.push({
        name: `Collection: ${coll.slug}`,
        status: 'fail',
        message: error instanceof Error ? error.message : String(error),
      })
      console.log(`✗ ${coll.slug.padEnd(20)} | ${error instanceof Error ? error.message : error}`)
    }
  }

  // ============ Detailed Coverage Analysis ============
  console.log('\n📊 COVERAGE DETAILS\n')
  console.log('=' .repeat(80))

  // Test specific seeded content
  const contentTests = [
    { collection: 'case-study', expectedCount: 4, name: 'Case Studies' },
    { collection: 'blog', expectedCount: 7, name: 'Blog Posts' },
    { collection: 'checklist', expectedCount: 1, name: 'Checklists' },
  ]

  for (const test of contentTests) {
    try {
      const result = await payload.find({
        collection: test.collection,
        limit: 1000,
        depth: 0,
      })
      const count = result.totalDocs
      const status = count >= test.expectedCount ? 'pass' : 'warn'
      const symbol = status === 'pass' ? '✓' : '⚠'
      console.log(
        `${symbol} ${test.name.padEnd(30)} | Found: ${count}, Expected: ${test.expectedCount}`,
      )
      results.push({
        name: `Content: ${test.name}`,
        status,
        count,
        message: `Expected ${test.expectedCount}, found ${count}`,
      })
    } catch (error) {
      console.log(`✗ ${test.name.padEnd(30)} | Error: ${error instanceof Error ? error.message : error}`)
      results.push({
        name: `Content: ${test.name}`,
        status: 'fail',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // ============ Route and Detail UI Contracts ============
  console.log('\n🔗 TESTING ROUTE AND DETAIL UI CONTRACTS\n')

  try {
    const result = await payload.find({
      collection: 'case-study',
      where: { slug: { equals: 'bms-platform' } },
      limit: 1,
      depth: 0,
    })
    const project = result.docs[0]
    const hasDetailData =
      project?.featured === true &&
      Array.isArray(project?.overview) &&
      project.overview.length > 0 &&
      Array.isArray(project?.specGroups) &&
      project.specGroups.length > 0
    results.push({
      name: 'Case-study overview and specification groups',
      status: hasDetailData ? 'pass' : 'fail',
      message: hasDetailData ? undefined : 'BMS Platform is missing its featured flag, overview, or specGroups seed data',
    })
    console.log(
      `${hasDetailData ? '✓' : '✗'} BMS detail content       | featured flag, overview, and specifications ${hasDetailData ? 'present' : 'missing'}`,
    )
  } catch (error) {
    results.push({
      name: 'Case-study overview and specification groups',
      status: 'fail',
      message: error instanceof Error ? error.message : String(error),
    })
    console.log(`✗ BMS detail content       | ${error instanceof Error ? error.message : error}`)
  }

  try {
    const result = await payload.find({
      collection: 'section',
      where: { title: { equals: 'PCB Design · shipped-products' } },
      limit: 1,
      depth: 1,
    })
    const section = result.docs[0]
    const cards = section?.cards
    const hasProjectRoutes =
      Array.isArray(cards) &&
      cards.length > 0 &&
      cards.every((card: any) => typeof card.ctaUrl === 'string' && card.ctaUrl.startsWith('/work/'))
    results.push({
      name: 'Capability project-card routes',
      status: hasProjectRoutes ? 'pass' : 'fail',
      message: hasProjectRoutes ? undefined : 'Shipped-product cards are missing canonical /work/ hrefs',
    })
    console.log(
      `${hasProjectRoutes ? '✓' : '✗'} Capability card routes   | canonical /work/ hrefs ${hasProjectRoutes ? 'present' : 'missing'}`,
    )
  } catch (error) {
    results.push({
      name: 'Capability project-card routes',
      status: 'fail',
      message: error instanceof Error ? error.message : String(error),
    })
    console.log(`✗ Capability card routes   | ${error instanceof Error ? error.message : error}`)
  }

  try {
    const footer = await payload.findGlobal({ slug: 'footer', depth: 0 })
    const hasCopyright = typeof footer.copyright === 'string' && footer.copyright.trim().length > 0
    const hasSupportDetails =
      footer.helplineNumber === '+1999 888-76-54' &&
      footer.techSupportEmail === 'support@canopy.com' &&
      footer.requestIntro === 'Raise a general' &&
      footer.requestLabel === 'IT Support Requests' &&
      footer.requestUrl === ''
    results.push({
      name: 'Footer top-level copyright',
      status: hasCopyright ? 'pass' : 'fail',
      message: hasCopyright ? undefined : 'Footer global has no top-level copyright value',
    })
    console.log(
      `${hasCopyright ? '✓' : '✗'} Footer copyright        | top-level value ${hasCopyright ? 'present' : 'missing'}`,
    )
    results.push({
      name: 'Footer typed support details',
      status: hasSupportDetails ? 'pass' : 'fail',
      message: hasSupportDetails ? undefined : 'Footer support defaults are missing or have unexpected destinations',
    })
    console.log(
      `${hasSupportDetails ? '✓' : '✗'} Footer support details  | typed defaults ${hasSupportDetails ? 'present' : 'missing'}`,
    )
  } catch (error) {
    results.push({
      name: 'Footer top-level copyright',
      status: 'fail',
      message: error instanceof Error ? error.message : String(error),
    })
    results.push({
      name: 'Footer typed support details',
      status: 'fail',
      message: error instanceof Error ? error.message : String(error),
    })
    console.log(`✗ Footer copyright        | ${error instanceof Error ? error.message : error}`)
  }

  // ============ Field Coverage Table ============
  console.log('\n' + '=' .repeat(80))
  console.log('SEEDED DATA FIELD COVERAGE TABLE\n')

  const table: string[][] = [
    ['Type', 'Name', 'Slug/ID', 'Status', 'Key Fields (sample)'],
  ]

  for (const row of coverage) {
    table.push([
      row.type,
      row.name,
      row.slug || '—',
      row.status,
      row.fields.slice(0, 3).join(', '),
    ])
  }

  // Print table
  const widths = [12, 25, 20, 8, 40]
  for (let i = 0; i < table.length; i++) {
    const row = table[i]
    const isHeader = i === 0
    const line = row.map((cell, j) => cell.padEnd(widths[j])).join('│')
    console.log(line)
    if (isHeader) {
      console.log('─'.repeat(widths.reduce((a, b) => a + b + 1, 0)))
    }
  }

  // ============ Summary ============
  console.log('\n' + '=' .repeat(80))
  console.log('TEST SUMMARY\n')

  const passed = results.filter((r) => r.status === 'pass').length
  const failed = results.filter((r) => r.status === 'fail').length
  const warned = results.filter((r) => r.status === 'warn').length

  console.log(`📊 Results: ${passed} passed, ${failed} failed, ${warned} warned`)
  console.log(`✓ Passed: ${passed}`)
  if (failed > 0) console.log(`✗ Failed: ${failed}`)
  if (warned > 0) console.log(`⚠ Warned: ${warned}`)

  // Show failures if any
  if (failed > 0) {
    console.log('\n⚠️  FAILURES:\n')
    results
      .filter((r) => r.status === 'fail')
      .forEach((r) => {
        console.log(`  ✗ ${r.name}`)
        if (r.message) console.log(`    ${r.message}`)
      })
  }

  // ============ Placeholder Detection ============
  console.log('\n' + '=' .repeat(80))
  console.log('PLACEHOLDER CONTENT CHECK\n')

  let placeholderCount = 0
  let totalFields = 0

  try {
    // Sample check across collections for [TODO:] placeholders
    const collections_to_check = [
      { slug: 'page', field: 'heading' },
      { slug: 'case-study', field: 'heading' },
      { slug: 'blog', field: 'heading' },
    ]

    for (const coll of collections_to_check) {
      const result = await payload.find({
        collection: coll.slug,
        limit: 1000,
        depth: 0,
      })

      for (const doc of result.docs) {
        if (doc[coll.field]?.includes('[TODO:')) {
          placeholderCount++
        }
        totalFields++
      }
    }

    console.log(
      `📝 Placeholder content detected: ${placeholderCount} fields with [TODO:] markers`,
    )
    console.log(`   (${totalFields} total fields sampled across collections)`)
    console.log(
      `\n💡 Tip: Edit these via the Payload admin UI at http://localhost:3000/admin`,
    )
  } catch (error) {
    console.log(`⚠  Could not check for placeholders: ${error instanceof Error ? error.message : error}`)
  }

  // ============ Final Status ============
  console.log('\n' + '=' .repeat(80))
  if (failed === 0) {
    console.log('✅ ALL TESTS PASSED\n')
    console.log('Next steps:')
    console.log('  1. Start the CMS: pnpm run dev')
    console.log('  2. Open admin UI: http://localhost:3000/admin')
    console.log('  3. Start the Angular SPA from canopy-Website: npm run start\n')
    process.exit(0)
  } else {
    console.log('❌ SOME TESTS FAILED\n')
    console.log('Check the failures above and ensure:')
    console.log('  1. Database migration was applied')
    console.log('  2. Seed script ran successfully')
    console.log('  3. Dev server is running\n')
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

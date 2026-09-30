import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import { getPayload } from 'payload'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// ============ Load JSON Data ============

function loadJSON<T>(jsonPath: string): T {
  try {
    const fullPath = path.resolve(dirname, jsonPath)
    const content = readFileSync(fullPath, 'utf-8')
    return JSON.parse(content) as T
  } catch (error) {
    console.warn(`⚠ Could not load JSON at ${jsonPath}:`, error instanceof Error ? error.message : error)
    return {} as T
  }
}

const dataDir = '../../Canopy-Website/public/data'
const homeData = loadJSON<any>(`${dataDir}/home.json`)
const siteData = loadJSON<any>(`${dataDir}/site.json`)
const servicesData = loadJSON<any>(`${dataDir}/services.json`)
const projectsData = loadJSON<any>(`${dataDir}/projects.json`)
const checklistData = loadJSON<any>(`${dataDir}/checklist.json`)
const blogsData = loadJSON<any>(`${dataDir}/blogs.json`)
const testimonialsData = loadJSON<any>(`${dataDir}/testimonials.json`)

// ============ Markdown to Lexical Helper ============

// Node builders matching Lexical's SerializedEditorState schema exactly
// (per @payloadcms/richtext-lexical/dist/populateGraphQL/defaultValue.js) —
// omitting fields like format/indent/version/direction causes the admin UI's
// Lexical editor to fail deserializing the value, and downstream consumers
// that walk this tree (e.g. a richText-to-HTML renderer) rely on these fields.

function textNode(text: string): any {
  return { type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text, version: 1 }
}

function paragraphNode(text: string): any {
  return {
    type: 'paragraph',
    children: text ? [textNode(text)] : [],
    direction: null,
    format: '',
    indent: 0,
    textFormat: 0,
    textStyle: '',
    version: 1,
  }
}

function headingNode(text: string, tag: 'h2' | 'h3'): any {
  return {
    type: 'heading',
    tag,
    children: [textNode(text)],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  }
}

function listItemNode(text: string, value: number): any {
  return {
    type: 'listitem',
    value,
    children: [textNode(text)],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  }
}

function listNode(items: string[], listType: 'bullet' | 'number'): any {
  return {
    type: 'list',
    listType,
    tag: listType === 'bullet' ? 'ul' : 'ol',
    start: 1,
    children: items.map((text, i) => listItemNode(text, i + 1)),
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  }
}

function rootNode(children: any[]): any {
  return {
    root: {
      type: 'root',
      children: children.length > 0 ? children : [paragraphNode('')],
      direction: null,
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

function markdownToLexical(markdown: string): any {
  if (!markdown || typeof markdown !== 'string') return rootNode([])

  const lines = markdown.split('\n').filter((l) => l.trim())
  const children: any[] = []

  // Consecutive '- ' / '1. ' lines must collapse into a single list node with
  // multiple listitem children, not one separate single-item list per line.
  let pendingListItems: string[] = []
  let pendingListType: 'bullet' | 'number' | null = null

  const flushList = () => {
    if (pendingListItems.length > 0 && pendingListType) {
      children.push(listNode(pendingListItems, pendingListType))
    }
    pendingListItems = []
    pendingListType = null
  }

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flushList()
      children.push(headingNode(line.slice(3).trim(), 'h2'))
    } else if (line.startsWith('### ')) {
      flushList()
      children.push(headingNode(line.slice(4).trim(), 'h3'))
    } else if (line.startsWith('- ')) {
      if (pendingListType !== 'bullet') flushList()
      pendingListType = 'bullet'
      pendingListItems.push(line.slice(2).trim())
    } else if (/^\d+\.\s/.test(line)) {
      if (pendingListType !== 'number') flushList()
      pendingListType = 'number'
      pendingListItems.push(line.replace(/^\d+\.\s/, '').trim())
    } else if (line.trim()) {
      flushList()
      children.push(paragraphNode(line.trim()))
    }
  }
  flushList()

  return rootNode(children)
}

interface UpsertResult<T> {
  doc: T
  created: boolean
}

async function main() {
  let payload: any
  try {
    const configModule = await import(path.resolve(dirname, '../src/payload.config.ts'))
    payload = await getPayload({ config: configModule.default })

    console.log('✓ Connected to Payload')

    await seedMedia()
    await seedGlobals()
    await seedPages()
    await seedCaseStudies()
    await seedBlogs()
    await seedChecklists()
    await seedTestimonials()

    console.log('\n✓ Seeding complete!')
    process.exit(0)
  } catch (error) {
    console.error('\n✗ Seeding failed:', error)
    process.exit(1)
  }

  // ============ Helpers ============

  async function findOrCreate<T extends { id?: string }>(
    collection: string,
    where: Record<string, any>,
    data: Record<string, any>,
  ): Promise<UpsertResult<T>> {
    try {
      const result = await payload.find({
        collection,
        where,
        limit: 1,
        depth: 0,
      })

      if (result.docs.length > 0) {
        const updated = await payload.update({
          collection,
          id: result.docs[0].id,
          data,
        })
        console.log(`  Updated ${collection}: ${data.name || data.slug || data.title || data.heading}`)
        return { doc: updated, created: false }
      }
    } catch (e) {
      // Continue to create
    }

    const created = await payload.create({
      collection,
      data,
    })
    console.log(`  Created ${collection}: ${data.name || data.slug || data.title || data.heading}`)
    return { doc: created, created: true }
  }

  async function seedMedia() {
    console.log('\n→ Seeding Media...')
    const logos = [
      { filename: 'logo-green.png', alt: 'Canopy Logo - Green' },
      { filename: 'logo-white.png', alt: 'Canopy Logo - White' },
      { filename: 'logo-grey.png', alt: 'Canopy Logo - Grey' },
    ]

    for (const { alt } of logos) {
      try {
        await findOrCreate<any>(
          'media',
          { alt: { equals: alt } },
          { alt },
        )
      } catch (error) {
        console.warn(`  ⚠ Skipped media ${alt}: ${error instanceof Error ? error.message : error}`)
      }
    }
    console.log('    💡 Note: You can upload logo files via admin UI at /admin')
  }

  async function seedGlobals() {
    console.log('\n→ Seeding Globals...')

    // SeoSettings
    console.log('  Seeding SeoSettings...')
    await payload.updateGlobal({
      slug: 'seo-settings',
      data: {
        allowIndexing: true,
        sitemapUrl: 'https://www.canopyembedded.com/sitemap.xml',
        disallowPaths: [
          { path: '/admin' },
          { path: '/api/*' },
        ],
      },
    })
    console.log('    Updated seo-settings')

    // Header
    console.log('  Seeding Header...')

    // Warn when a seeded nav link doesn't resolve to a real frontend route
    // (Canopy-Website/src/app/app.routes.ts) — stale links hit the not-found page.
    const KNOWN_ROUTES = ['/', '/about', '/work', '/capabilities', '/engagement-model', '/resources', '/insights']
    const navItemList = Array.isArray(siteData.nav?.navItems) ? siteData.nav.navItems : []
    for (const item of navItemList) {
      const href: string = item?.href || ''
      if (!href || /^(mailto:|tel:|https?:)/.test(href)) continue
      const routePath = href.split('#')[0].replace(/\/+$/, '') || '/'
      const matches = KNOWN_ROUTES.some((r) => routePath === r || (r !== '/' && routePath.startsWith(`${r}/`)))
      if (!matches) {
        console.warn(`    ⚠ Nav link "${item?.label}" -> "${href}" matches no frontend route`)
      }
    }

    const primaryLogo = await payload.find({
      collection: 'media',
      where: { alt: { equals: 'Canopy Logo - Green' } },
      limit: 1,
    })

    const headerData: any = {
      navItems: siteData.nav?.navItems || { items: [] },
      navCta: siteData.nav?.navCta ? { label: siteData.nav.navCta.label, url: siteData.nav.navCta.href } : { label: 'Book a Consultation', url: '/engagement-model/' },
    }

    // Only add logo if it exists
    if (primaryLogo.docs[0]?.id) {
      headerData.primaryLogo = primaryLogo.docs[0].id
    }

    await payload.updateGlobal({
      slug: 'header',
      data: headerData,
    })
    console.log('    Updated header')

    // Footer — content is a free-form JSON field; seed the site.json footer
    // block verbatim so new footer details never require a schema change.
    console.log('  Seeding Footer...')
    const footerData: any = {
      content: siteData.footer || {},
    }

    // Only add logo if it exists
    if (primaryLogo.docs[0]?.id) {
      footerData.logo = primaryLogo.docs[0].id
    }

    await payload.updateGlobal({
      slug: 'footer',
      data: footerData,
    })
    console.log('    Updated footer')

    // SiteChrome
    console.log('  Seeding SiteChrome...')
    await payload.updateGlobal({
      slug: 'site-chrome',
      data: {
        primaryCta: {
          label: 'Talk to an Engineer',
          url: '/engagement-model/',
        },
        backLinks: {
          portfolio: '← Back to Portfolio',
          insights: '← Back to Insights',
          capabilities: '← Back to Capabilities',
        },
        emptyStates: {
          noProjects: 'No projects available yet.',
          noInsights: 'No insights available yet.',
        },
        listLabels: {
          viewProjectCta: 'View Project →',
          readArticleCta: 'Read Article →',
          viewDetailsCta: 'View Details →',
        },
        checklistUi: {
          itemsHeading: 'Checklist Items',
          lockedItemsSuffixTemplate: '+ {count} more items locked (submit form to unlock)',
          downloadPrompt: 'Download the full checklist with all items:',
          getFullChecklistCta: 'Get Full Checklist',
        },
        checklistModal: {
          title: 'What do you need help with?',
          subtitle: 'Choose the area to continue with the appropriate checklist',
          continueCta: 'Continue',
          // ids are checklist slugs so the modal's Continue navigates to /resources/<slug>
          fallbackCategories: [
            { id: 'hardware-audit-checklist', label: 'Hardware' },
            { id: 'iot-app-cloud-readiness-checklist', label: 'UI/UX & Cloud' },
          ],
        },
        notFound: {
          heading: 'Page Not Found',
          body: 'The page you are looking for does not exist.',
          ctaLabel: 'Return to Home',
          ctaUrl: '/',
        },
        navFallback: {
          logoText: 'Canopy',
        },
      },
    })
    console.log('    Updated site-chrome')
  }

  async function seedPages() {
    console.log('\n→ Seeding Pages...')

    // Home page using Page + Section + Card model
    console.log('  Creating Home page with sections...')
    const homeSections: any[] = []

    // Helper to seed a section
    const seedSection = async (title: string, data: any) => {
      const cards: any[] = []
      const sectionCards = data.cards || data.serviceCard || data.breakPoints || data.steps || data.featured || []

      for (const card of sectionCards) {
        const cardData = {
          title: card.title || card.heading || card.label || '',
          heading: card.heading || card.title || '',
          description: markdownToLexical(card.description || ''),
          category: card.category || '',
          ctaLabel: card.ctaLabel || '',
          ctaUrl: card.ctaHref || card.href || '',
          tags: card.tags ? (typeof card.tags === 'string' ? card.tags : card.tags.join(', ')) : '',
        }

        const cardResult = await findOrCreate<any>(
          'card',
          { title: { equals: card.title || card.heading } },
          cardData,
        )
        cards.push(cardResult.doc.id)
      }

      const sectionData = {
        title,
        heading: data.heading || data.title || '',
        subheading: data.subHeading || data.subheading || '',
        body: markdownToLexical(data.description || ''),
        cards,
        constant: {},
      }

      const sectionResult = await findOrCreate<any>(
        'section',
        { title: { equals: title } },
        sectionData,
      )
      return sectionResult.doc.id
    }

    // Seed each major section from home.json
    if (homeData.banner) {
      const bannerId = await seedSection('Banner', homeData.banner)
      homeSections.push(bannerId)
    }

    if (homeData.serviceCards) {
      const serviceId = await seedSection('Services', homeData.serviceCards)
      homeSections.push(serviceId)
    }

    if (homeData.capabilityCards) {
      const capId = await seedSection('Capabilities', homeData.capabilityCards)
      homeSections.push(capId)
    }

    if (homeData.clients) {
      const clientId = await seedSection('Approach / Builds Break', homeData.clients)
      homeSections.push(clientId)
    }

    if (homeData.howWeWork) {
      const workId = await seedSection('How We Work', homeData.howWeWork)
      homeSections.push(workId)
    }

    if (homeData.newsroom) {
      const newsId = await seedSection('Featured Projects', homeData.newsroom)
      homeSections.push(newsId)
    }

    if (homeData.contactCta) {
      const ctaId = await seedSection('Contact CTA', homeData.contactCta)
      homeSections.push(ctaId)
    }

    // Seed the home Page document
    const homePageData = {
      title: 'Home',
      url: '/',
      heading: 'You Have the Idea. We\'re the Team to Build It.',
      subheading: homeData.banner?.subheading || 'From the first sketch to the final product, we work alongside you to design, build, test.',
      body: markdownToLexical('Welcome to Canopy Embedded Labs'),
      layoutSections: homeSections,
      seo: {
        seoTitle: homeData.htmlTitle || 'Canopy Embedded | From first sketch to field-ready product',
        metaDescription: 'Full-stack electronics product development: PCB design, firmware, enclosures, UI/UX and IoT cloud apps from one team.',
        canonicalUrl: 'https://www.canopyembedded.com/',
        robots: { index: true, follow: true },
        schemaType: 'Organization',
      },
    }

    await findOrCreate('page', { url: { equals: '/' } }, homePageData)

    // PCB Design capability page from services.json
    if (servicesData.sections && servicesData.sections.length > 0) {
      const pcbCardIds: any[] = []
      const includedSection = servicesData.sections.find((s: any) => s.id === 'included')

      if (includedSection && includedSection.cards) {
        for (const card of includedSection.cards) {
          const cardData = {
            title: card.heading || card.id || '',
            heading: card.heading || '',
            subheading: card.subheading || '',
            description: markdownToLexical(card.description || ''),
            category: 'PCB Design',
            tags: card.tags ? (Array.isArray(card.tags) ? card.tags.join(', ') : card.tags) : '',
            type: 'grid',
          }

          const cardResult = await findOrCreate<any>(
            'card',
            { title: { equals: card.heading || card.id } },
            cardData,
          )
          pcbCardIds.push(cardResult.doc.id)
        }
      }

      // Collect workflow steps
      const workflowSteps: any[] = []
      const workflowSection = servicesData.sections.find((s: any) => s.id === 'workflow')

      if (workflowSection && workflowSection.cards) {
        for (let i = 0; i < workflowSection.cards.length; i++) {
          const card = workflowSection.cards[i]
          workflowSteps.push({
            stepNumber: i + 1,
            title: card.heading || '',
            description: card.description || '',
          })
        }
      }

      const pcbPageData = {
        title: 'PCB Design',
        url: '/capabilities/pcb-design/',
        heading: servicesData.heading || 'PCB Design & Architecture',
        subheading: servicesData.subheading || '',
        body: markdownToLexical(servicesData.body || ''),
        cards: pcbCardIds,
        workflowSteps,
        seo: {
          seoTitle: servicesData.htmlTitle || 'Hardware Design & PCB Architecture | Canopy',
          metaDescription: servicesData.seo?.metaDescription || 'PCB design and hardware architecture services.',
          canonicalUrl: 'https://www.canopyembedded.com/capabilities/pcb-design/',
          robots: { index: true, follow: true },
          schemaType: 'none',
        },
      }

      await findOrCreate('page', { url: { equals: '/capabilities/pcb-design/' } }, pcbPageData)
    }

    // Static pages with placeholders
    const staticPages = [
      {
        title: 'About',
        url: '/about/',
        heading: 'About Canopy',
        subheading: 'Electronics product development from India',
        body: markdownToLexical('[TODO: About page body from v83]'),
        companyFacts: {
          name: 'Canopy Embedded Labs',
          location: 'India',
          sectors: [{ sector: '[TODO: Sector 1]' }],
          contactEmail: 'contact@canopyembedded.com',
        },
        seo: {
          seoTitle: 'About Canopy Embedded Labs',
          metaDescription: '[TODO: About meta description]',
          canonicalUrl: 'https://www.canopyembedded.com/about/',
          robots: { index: true, follow: true },
          schemaType: 'Organization',
        },
      },
      {
        title: 'Capabilities Overview',
        url: '/capabilities/',
        heading: 'Our Capabilities',
        body: markdownToLexical('[TODO: Capabilities overview from v83]'),
        seo: {
          seoTitle: 'Capabilities | Canopy Embedded',
          metaDescription: '[TODO: Capabilities meta]',
          canonicalUrl: 'https://www.canopyembedded.com/capabilities/',
          robots: { index: true, follow: true },
          schemaType: 'none',
        },
      },
      {
        title: 'Engagement Model',
        url: '/engagement-model/',
        heading: 'How We Work Together',
        body: markdownToLexical('[TODO: Engagement Model body from v83]'),
        seo: {
          seoTitle: 'Engagement Model | Canopy Embedded',
          metaDescription: '[TODO: Engagement Model meta]',
          canonicalUrl: 'https://www.canopyembedded.com/engagement-model/',
          robots: { index: true, follow: true },
          schemaType: 'none',
        },
      },
    ]

    for (const page of staticPages) {
      await findOrCreate('page', { url: { equals: page.url } }, page)
    }

    // Remaining capability tracks listed on the capabilities overview page.
    // Static JSON only covers pcb-design — seed the shells (matching the Page
    // shape capability-detail renders) so every /capabilities/:slug resolves;
    // content is authored in the CMS from here.
    const capabilityTracks = [
      { slug: 'firmware', title: 'Deep Firmware Engineering' },
      { slug: 'mechanical-design', title: 'Mechanical Design' },
      { slug: 'industrial-design', title: 'Industrial Design' },
      { slug: 'hmi-ui-ux', title: 'UI/UX Architecture & Embedded HMI' },
      { slug: 'iot-apps-cloud', title: 'App Development & Cloud Systems' },
    ]

    for (const track of capabilityTracks) {
      await findOrCreate(
        'page',
        { url: { equals: `/capabilities/${track.slug}/` } },
        {
          title: track.title,
          url: `/capabilities/${track.slug}/`,
          heading: track.title,
          subheading: `[TODO: ${track.title} subheading]`,
          body: markdownToLexical(`[TODO: ${track.title} page body]`),
          seo: {
            seoTitle: `${track.title} | Canopy Embedded`,
            metaDescription: `[TODO: ${track.title} meta description]`,
            canonicalUrl: `https://www.canopyembedded.com/capabilities/${track.slug}/`,
            robots: { index: true, follow: true },
            schemaType: 'none',
          },
        },
      )
    }
  }

  async function seedTestimonials() {
    console.log('\n→ Seeding Testimonials...')

    const cards = testimonialsData.sections?.[0]?.cards || []
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i]
      await findOrCreate(
        'testimonial',
        { heading: { equals: card.heading } },
        {
          heading: card.heading || '',
          clientLabel: card.subheading || 'Canopy client',
          quote: card.description || card.body || '',
          order: i + 1,
        },
      )
    }
  }

  async function seedCaseStudies() {
    console.log('\n→ Seeding Case Studies...')

    const projectMap: { [key: string]: any } = {
      'bms-platform': { slug: 'smart-bms' },
      'dual-channel-smart-charger': { slug: 'dual-channel-charger' },
      'ble-mesh-rs485-board': { slug: 'ble-mesh-rs485-node' },
      'edge-compute-gateway': { slug: 'edge-compute-gateway' },
    }

    for (const project of projectsData.projects || []) {
      const mapping = projectMap[project.id]
      const slug = mapping?.slug || project.slug || project.id

      const caseStudyData = {
        title: project.heading || project.title || '',
        slug,
        heading: project.heading || '',
        subheading: project.description || '',
        body: markdownToLexical(project.body || project.description || ''),
        projectStage: project.stage || 'in-design',
        atAGlance: project.glance || [],
        features: project.features || (project.overview ? project.overview.map((o: any) => ({ item: o.text || '' })) : []),
        technicalSpecifications: (project.specGroups || []).flatMap((g: any) =>
          (g.rows || []).map((r: any) => ({ item: `${r.label}: ${r.value}` }))
        ),
        tags: project.tags ? (Array.isArray(project.tags) ? project.tags.join(', ') : project.tags) : '',
        seo: {
          seoTitle: project.htmlTitle || project.heading || '',
          metaDescription: project.description || '',
          canonicalUrl: `https://www.canopyembedded.com/work/${slug}/`,
          robots: { index: true, follow: true },
          schemaType: 'Service',
        },
      }

      await findOrCreate('case-study', { slug: { equals: slug } }, caseStudyData)
    }
  }

  async function seedBlogs() {
    console.log('\n→ Seeding Blogs...')

    for (const blog of blogsData.posts || []) {
      const blogData = {
        title: blog.title || '',
        slug: blog.slug || '',
        heading: blog.heading || '',
        dek: blog.description || blog.subheading || '',
        byline: 'Canopy Embedded Labs engineering team',
        publishedDate: blog.date ? new Date(blog.date) : new Date(),
        body: markdownToLexical(blog.richBody || blog.description || 'Body content pending.'),
        tags: (blog.tags || []).map((t: string) => ({ tag: t })),
        seo: {
          seoTitle: blog.heading || '',
          metaDescription: blog.description || '',
          canonicalUrl: `https://www.canopyembedded.com${blog.href || `/insights/${blog.slug}/`}`,
          robots: { index: true, follow: true },
          schemaType: 'BlogPosting',
        },
      }

      await findOrCreate('blog', { slug: { equals: blog.slug } }, blogData)
    }
  }

  async function seedChecklists() {
    console.log('\n→ Seeding Checklists...')

    // Hardware Audit Checklist
    const hardwareItems = checklistData.sections?.[0]?.cards || []
    const visibleItems = hardwareItems.slice(0, 3).map((item: any) => ({
      item: `${item.heading}: ${item.description}`,
    }))

    await findOrCreate(
      'checklist',
      { slug: { equals: 'hardware-audit-checklist' } },
      {
        title: 'Hardware Audit Checklist',
        slug: 'hardware-audit-checklist',
        visibleItems: visibleItems.length > 0 ? visibleItems : [
          { item: 'Power architecture validation' },
          { item: 'Component selection & lifecycle' },
          { item: 'Thermal design review' },
        ],
        lockedItemsCount: 7,
        formId: 'form_hardware_audit_checklist',
        seo: {
          seoTitle: 'Hardware Audit Checklist | Canopy Embedded',
          metaDescription: 'Review ten engineering risks that lead to field returns before taking your hardware to production.',
          canonicalUrl: 'https://www.canopyembedded.com/resources/hardware-audit-checklist/',
          robots: { index: true, follow: true },
          schemaType: 'none',
        },
      },
    )

    // UI/UX & Cloud Readiness Checklist (placeholder, no source)
    await findOrCreate(
      'checklist',
      { slug: { equals: 'iot-app-cloud-readiness-checklist' } },
      {
        title: 'UI/UX & Cloud Readiness Checklist',
        slug: 'iot-app-cloud-readiness-checklist',
        visibleItems: [
          { item: '[TODO: UI/UX checklist item 1]' },
          { item: '[TODO: UI/UX checklist item 2]' },
          { item: '[TODO: UI/UX checklist item 3]' },
        ],
        lockedItemsCount: 7,
        formId: 'form_iot_app_cloud_readiness_checklist',
        seo: {
          seoTitle: 'UI/UX & Cloud Readiness Checklist | Canopy Embedded',
          metaDescription: '[TODO: Cloud checklist meta]',
          canonicalUrl: 'https://www.canopyembedded.com/resources/iot-app-cloud-readiness-checklist/',
          robots: { index: true, follow: true },
          schemaType: 'none',
        },
      },
    )
  }
}

main()

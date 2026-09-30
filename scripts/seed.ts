import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { existsSync, readFileSync } from 'fs'
import { getPayload } from 'payload'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// ============ Load JSON Data ============

function loadJSON<T>(jsonPath: string): T {
  const fullPath = path.resolve(dirname, jsonPath)
  const content = readFileSync(fullPath, 'utf-8')
  return JSON.parse(content) as T
}

const dataDir = '../seed-data'
const homeData = loadJSON<any>(`${dataDir}/home.json`)
const siteData = loadJSON<any>(`${dataDir}/site.json`)
const servicesData = loadJSON<any>(`${dataDir}/services.json`)
const projectsData = loadJSON<any>(`${dataDir}/projects.json`)
const checklistData = loadJSON<any>(`${dataDir}/checklist.json`)
const blogsData = loadJSON<any>(`${dataDir}/blogs.json`)
const testimonialsData = loadJSON<any>(`${dataDir}/testimonials.json`)

function getImageFields(value: any): { image?: number | string; imageUrl?: string } {
  if (typeof value === 'string') return { imageUrl: value }
  if (typeof value === 'number') return { image: value }
  if (value && typeof value === 'object') {
    const fields: { image?: number | string; imageUrl?: string } = {}
    if (typeof value.id === 'number' || typeof value.id === 'string') fields.image = value.id
    if (typeof value.url === 'string') fields.imageUrl = value.url
    return fields
  }
  return {}
}

// ============ Markdown to Lexical Helper ============

// Node builders matching Lexical's SerializedEditorState schema exactly
// (per @payloadcms/richtext-lexical/dist/populateGraphQL/defaultValue.js) —
// omitting fields like format/indent/version/direction causes the admin UI's
// Lexical editor to fail deserializing the value, and downstream consumers
// that walk this tree (e.g. a richText-to-HTML renderer) rely on these fields.

function textNode(text: string, format = 0): any {
  return { type: 'text', detail: 0, format, mode: 'normal', style: '', text, version: 1 }
}

function inlineMarkdownNodes(text: string): any[] {
  const tokenPattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`)/g
  const nodes: any[] = []
  let offset = 0

  for (const match of text.matchAll(tokenPattern)) {
    const token = match[0]
    const index = match.index
    if (index > offset) nodes.push(textNode(text.slice(offset, index)))

    const isBold = token.startsWith('**') || token.startsWith('__')
    const isCode = token.startsWith('`')
    const delimiterLength = isBold || isCode ? 2 : 1
    nodes.push(
      textNode(
        token.slice(delimiterLength, token.length - delimiterLength),
        isBold ? 1 : isCode ? 16 : 2,
      ),
    )
    offset = index + token.length
  }

  if (offset < text.length) nodes.push(textNode(text.slice(offset)))
  return nodes.length ? nodes : [textNode(text)]
}

function paragraphNode(text: string): any {
  return {
    type: 'paragraph',
    children: text ? inlineMarkdownNodes(text) : [],
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
    children: inlineMarkdownNodes(text),
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
    children: inlineMarkdownNodes(text),
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
    const configUrl = pathToFileURL(path.resolve(dirname, '../src/payload.config.ts')).href
    const configModule = await import(configUrl)
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
      { filename: 'favicon.png', alt: 'Canopy Browser Icon' },
    ]

    for (const { filename, alt } of logos) {
      const filePath = path.resolve(dirname, '../seed-data/media', filename)
      if (!existsSync(filePath)) {
        throw new Error(`Required media seed file is missing: ${filePath}`)
      }

      try {
        const result = await payload.find({
          collection: 'media',
          where: { alt: { equals: alt } },
          limit: 1,
          depth: 0,
        })
        if (result.docs[0]?.id) {
          await payload.update({
            collection: 'media',
            id: result.docs[0].id,
            data: { alt },
            filePath,
          })
        } else {
          await payload.create({
            collection: 'media',
            data: { alt },
            filePath,
          })
        }
        console.log(`  Stored media: ${alt}`)
      } catch (error) {
        throw new Error(`Failed to store media ${alt}`, { cause: error })
      }
    }
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
    const browserIcon = await payload.find({
      collection: 'media',
      where: { alt: { equals: 'Canopy Browser Icon' } },
      limit: 1,
    })
    if (!browserIcon.docs[0]?.id) {
      throw new Error('Canopy Browser Icon media record was not created')
    }
    await payload.updateGlobal({
      slug: 'seo-settings',
      data: { siteIcon: browserIcon.docs[0].id },
    })

    const headerData: any = {
      navItems: navItemList.map((item: any) => ({
        label: item.label || '',
        url: item.url || item.href || '',
      })),
      navCta: siteData.nav?.navCta
        ? { label: siteData.nav.navCta.label || '', href: siteData.nav.navCta.href || '' }
        : { label: 'Book a Consultation', href: '' },
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

    console.log('  Seeding Footer...')
    const footerContent = siteData.footer || {}
    const footerData: any = {
      copyright: footerContent.copyright || '',
      heading: footerContent.heading || 'Canopy Embedded',
      subHeading: footerContent.subHeading || 'Product engineering',
      homeLinkLabel: footerContent.homeLinkLabel || 'Canopy home',
      cta: {
        label: footerContent.cta?.label || '',
        href: footerContent.cta?.href || '',
      },
      socialNavLabel: footerContent.socialNavLabel || 'Social media',
      linkGroups: Array.isArray(footerContent.linkGroups)
        ? footerContent.linkGroups.map((group: any) => ({
            heading: group.heading || '',
            links: Array.isArray(group.links)
              ? group.links.map((link: any) => ({
                  label: link.label || '',
                  href: link.href || '',
                }))
              : [],
          }))
        : [],
      socialLinks: Array.isArray(footerContent.socialLinks) && footerContent.socialLinks.length > 0
        ? footerContent.socialLinks.map((link: any) => ({
            label: link.label || '',
            href: link.href || '',
            icon: ['linkedin', 'instagram', 'twitter'].includes(link.icon) ? link.icon : undefined,
          }))
        : [
            { label: 'LinkedIn', href: '', icon: 'linkedin' },
            { label: 'Instagram', href: '', icon: 'instagram' },
            { label: 'Twitter', href: '', icon: 'twitter' },
          ],
      helplineNumber: footerContent.helplineNumber || '+1999 888-76-54',
      techSupportEmail: footerContent.techSupportEmail || 'support@canopy.com',
      requestIntro: footerContent.requestIntro || 'Raise a general',
      requestLabel: footerContent.requestLabel || 'IT Support Requests',
      requestUrl: footerContent.requestUrl || '',
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
          viewDetailsCta: 'View Details',
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
        pageStates: {
          loading: 'Loading...',
          loadFailed: 'Content could not be loaded.',
        },
        accessibility: {
          skipToMain: 'Skip to main content',
          primaryNavigation: 'Primary navigation',
          homeLink: 'Canopy home',
          openNavigation: 'Open navigation menu',
          closeNavigation: 'Close navigation menu',
          closeDialog: 'Close dialog',
          checklistAreas: 'Checklist areas',
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
      const sourceCards = [
        ...(Array.isArray(data.cards) ? data.cards.map((card: any) => ({ card, cardType: card.type, sourceKind: 'cards' })) : []),
        ...(Array.isArray(data.serviceCard) ? data.serviceCard.map((card: any) => ({ card, cardType: 'service', sourceKind: 'serviceCard' })) : []),
        ...(Array.isArray(data.breakPoints) ? data.breakPoints.map((card: any) => ({ card, cardType: 'breakpoint', sourceKind: 'breakPoints' })) : []),
        ...(Array.isArray(data.stats) ? data.stats.map((card: any) => ({ card, cardType: 'stat', sourceKind: 'stats' })) : []),
        ...(Array.isArray(data.teamMembers) ? data.teamMembers.map((card: any) => ({ card, cardType: 'teamMember', sourceKind: 'teamMembers' })) : []),
        ...(Array.isArray(data.steps) ? data.steps.map((card: any) => ({ card, cardType: 'step', sourceKind: 'steps' })) : []),
        ...(Array.isArray(data.featured) ? data.featured.map((card: any) => ({ card, cardType: 'card', sourceKind: 'featured' })) : []),
      ]

      for (const { card, cardType, sourceKind } of sourceCards) {
        const cardTitle = card.title || card.heading || card.label
        if (typeof cardTitle !== 'string' || !cardTitle.trim()) {
          throw new Error(`Section "${title}" contains a card without a title`)
        }
        let ctaUrl = card.ctaHref || card.cta?.href || card.href || ''
        if (!ctaUrl && sourceKind === 'featured') {
          const existingCaseStudy = await payload.find({
            collection: 'case-study',
            where: { title: { equals: cardTitle } },
            limit: 1,
            depth: 0,
          })
          const matchingProject = existingCaseStudy.docs[0]?.slug
            ? existingCaseStudy.docs[0]
            : (projectsData.projects || []).find(
            (project: any) =>
              project.title === cardTitle ||
              project.heading === cardTitle ||
              project.slug === card.id,
            )
          if (matchingProject?.slug) ctaUrl = `/work/${matchingProject.slug}/`
        }
        const cardData = {
          title: cardTitle,
          heading: card.heading || card.title || card.label || '',
          ...getImageFields(card.image),
          subheading: card.subheading || '',
          index: card.index || card.number || '',
          value: card.value || '',
          category: card.category || '',
          role: card.role || '',
          date: card.date || '',
          imageAlt: card.imageAlt || '',
          icon: card.icon || '',
          theme: card.theme || '',
          shortDescription: card.shortDescription || '',
          description: markdownToLexical(card.description || ''),
          additionalDescription: markdownToLexical(card.additionalDescription || ''),
          body: card.body || '',
          ctaLabel: card.ctaLabel || '',
          ctaUrl,
          readMoreLabel: card.readMoreLabel || '',
          linkedinUrl: card.linkedinUrl || '',
          type: cardType || 'card',
          tags: Array.isArray(card.tags)
            ? card.tags.map((tag: any) => ({ tag: typeof tag === 'string' ? tag : tag.tag || '' }))
            : typeof card.tags === 'string'
              ? card.tags.split(',').map((tag: string) => ({ tag: tag.trim() }))
              : [],
        }

        const cardResult = await findOrCreate<any>(
          'card',
          { title: { equals: cardTitle } },
          cardData,
        )
        cards.push(cardResult.doc.id)
      }

      const sectionData = {
        title,
        ...getImageFields(data.image),
        sectionKey: data.id || '',
        heading: data.heading || data.title || '',
        headingFirstLine: data.headingFirstLine || '',
        headingSecondLine: data.headingSecondLine || '',
        subheading: data.subHeading || data.subheading || '',
        summary: data.summary || '',
        eyebrow: data.eyebrow || '',
        tagLine: data.tagLine || '',
        highlight: data.highlight || '',
        type: data.type || '',
        imageAlt: data.imageAlt || data.previewAlt || '',
        logo: data.logo || '',
        previewAlt: data.previewAlt || '',
        backgroundImage: data.backgroundImage || '',
        backgroundVideo: data.backgroundVideo || '',
        mockup: data.mockup
          ? {
              assistantName: data.mockup.assistantName || '',
              schedulingMessage: data.mockup.schedulingMessage || '',
              timeSlots: Array.isArray(data.mockup.timeSlots)
                ? data.mockup.timeSlots.map((value: any) => ({ value: typeof value === 'string' ? value : value.value || '' }))
                : [],
              syncTitle: data.mockup.syncTitle || '',
              telemetryTitle: data.mockup.telemetryTitle || '',
              telemetryMetrics: Array.isArray(data.mockup.telemetryMetrics)
                ? data.mockup.telemetryMetrics.map((value: any) => ({ value: typeof value === 'string' ? value : value.value || '' }))
                : [],
            }
          : undefined,
        imageLabels: Array.isArray(data.imageLabels)
          ? data.imageLabels.map((label: any) => ({ label: typeof label === 'string' ? label : label.label || '' }))
          : [],
        body: markdownToLexical(data.description || ''),
        cta: data.cta ? { label: data.cta.label || '', href: data.cta.href || '' } : undefined,
        secondaryCta: data.secondaryCta
          ? { label: data.secondaryCta.label || '', href: data.secondaryCta.href || '' }
          : undefined,
        controls: data.controls
          ? {
              tabsLabel: data.controls.tabsLabel || '',
              previousLabel: data.controls.previousLabel || '',
              nextLabel: data.controls.nextLabel || '',
            }
          : undefined,
        categories: Array.isArray(data.categories)
          ? data.categories.map((category: any) => ({
              category: typeof category === 'string' ? category : category.category || '',
            }))
          : [],
        cards,
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

    const testimonialSection = testimonialsData.sections?.[0]
    if (testimonialSection) {
      const testimonialId = await seedSection('Testimonials', {
        title: testimonialSection.title,
        heading: testimonialsData.heading || testimonialSection.heading,
        subheading: testimonialsData.subheading || testimonialSection.subheading,
        cards: testimonialSection.cards || [],
      })
      homeSections.push(testimonialId)
    }

    // Seed the home Page document
    const homePageData = {
      title: 'Home',
      url: '/',
      heading: homeData.banner?.heading || homeData.title,
      subheading: homeData.banner?.subheading || '',
      body: markdownToLexical(homeData.banner?.body || ''),
      layoutSections: homeSections,
      seo: {
        seoTitle: homeData.htmlTitle || homeData.title,
        metaDescription: homeData.seo?.metaDescription || '',
        canonicalUrl: 'https://www.canopyembedded.com/',
        robots: { index: true, follow: true },
        schemaType: 'Organization',
      },
    }

    await findOrCreate('page', { url: { equals: '/' } }, homePageData)

    // PCB Design capability page from services.json
    if (servicesData.sections && servicesData.sections.length > 0) {
      const pcbCardIds: any[] = []
      const serviceSectionIds: string[] = []
      const includedSection = servicesData.sections.find((s: any) => s.id === 'included')

      if (includedSection && includedSection.cards) {
        for (const card of includedSection.cards) {
          const cardData = {
            title: card.heading || card.id || '',
            heading: card.heading || '',
            subheading: card.subheading || '',
            description: markdownToLexical(card.description || ''),
            category: 'PCB Design',
            tags: Array.isArray(card.tags)
              ? card.tags.map((tag: string) => ({ tag }))
              : typeof card.tags === 'string'
                ? card.tags.split(',').map((tag: string) => ({ tag: tag.trim() }))
                : [],
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

      for (const section of servicesData.sections) {
        const sectionTitle = `PCB Design · ${section.id}`
        serviceSectionIds.push(await seedSection(sectionTitle, section))
      }

      const pcbPageData = {
        title: 'PCB Design',
        url: '/capabilities/pcb-design/',
        heading: servicesData.heading || 'PCB Design & Architecture',
        subheading: servicesData.subheading || '',
        body: markdownToLexical(servicesData.body || ''),
        cta: servicesData.cta
          ? { label: servicesData.cta.label || '', href: servicesData.cta.href || '' }
          : undefined,
        layoutSections: serviceSectionIds,
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

    const insightsLayoutSectionIds: string[] = []
    for (const section of blogsData.page.sections || []) {
      const sectionTitle = section.heading || section.title
      if (typeof sectionTitle !== 'string' || !sectionTitle.trim()) {
        throw new Error('Insights page section is missing a title')
      }
      insightsLayoutSectionIds.push(await seedSection(sectionTitle, section))
    }

    const cmsPages = [
      {
        title: projectsData.title,
        url: '/work/',
        heading: projectsData.heading || projectsData.title,
        subheading: projectsData.subtitle || '',
      },
      {
        title: servicesData.title,
        url: '/capabilities/',
        heading: servicesData.title,
        subheading: servicesData.subheading || '',
        cta: servicesData.cta
          ? { label: servicesData.cta.label || '', href: servicesData.cta.href || '' }
          : undefined,
      },
      {
        title: blogsData.page.title,
        url: '/insights/',
        heading: blogsData.page.heading,
        subheading: blogsData.page.subheading || '',
        cta: blogsData.page.cta,
        layoutSections: insightsLayoutSectionIds,
        seo: {
          seoTitle: blogsData.page.htmlTitle || blogsData.page.title,
          metaDescription: blogsData.page.seo?.metaDescription || '',
          canonicalUrl: 'https://www.canopyembedded.com/insights/',
          robots: { index: true, follow: true },
          schemaType: 'none',
        },
      },
      {
        title: homeData.howWeWork.heading,
        url: '/engagement-model/',
        heading: [homeData.howWeWork.heading, homeData.howWeWork.highlight]
          .filter(Boolean)
          .join(' '),
        subheading: homeData.howWeWork.description || '',
        body: markdownToLexical(homeData.howWeWork.description || ''),
        workflowSteps: (homeData.howWeWork.steps || []).map((step: any, index: number) => ({
          stepNumber: index + 1,
          title: step.label || '',
          description: step.description || '',
        })),
      },
    ]

    for (const page of cmsPages) {
      await findOrCreate('page', { url: { equals: page.url } }, page)
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

    for (const project of projectsData.projects || []) {
      const slug = project.slug || project.id
      const specificationItems = (project.specGroups || []).flatMap((group: any) =>
        (group.rows || [])
          .filter(
            (row: any) =>
              typeof row.value === 'string' &&
              !/\[[^\]]*\]/.test(row.value),
          )
          .map((row: any) => ({
            item: row.value ? `${row.label}: ${row.value}` : row.label,
          })),
      )

      const title = project.heading || project.title || ''
      const caseStudyData = {
        title,
        slug,
        heading: project.heading || '',
        subheading: project.description || '',
        category: project.category || '',
        featured: project.featured === true,
        overview: project.overview || [],
        specGroups: project.specGroups || [],
        body: markdownToLexical(
          project.body ||
            (project.overview || []).map((item: any) => item.text).filter(Boolean).join('\n\n') ||
            project.description ||
            '',
        ),
        atAGlance: (project.glance || []).filter(
          (item: any) =>
            typeof item.value === 'string' &&
            !/\[[^\]]*\]/.test(item.value),
        ),
        features: project.features || (project.overview ? project.overview.map((o: any) => ({ item: o.text || '' })) : []),
        technicalSpecifications: specificationItems,
        tags: project.tags ? (Array.isArray(project.tags) ? project.tags.join(', ') : project.tags) : '',
        cardCta: {
          label: project.cardCtaLabel || 'View Project',
          link: `/work/${slug}/`,
        },
        pageCta: {
          label: project.pageCtaLabel || '',
          link: project.pageCtaLink || '',
        },
        seo: {
          seoTitle: project.htmlTitle || project.heading || project.title || '',
          metaDescription: project.description || '',
          canonicalUrl: `https://www.canopyembedded.com/work/${slug}/`,
          robots: { index: true, follow: true },
          schemaType: 'Service',
        },
      }

      await findOrCreate(
        'case-study',
        { or: [{ slug: { equals: slug } }, { title: { equals: title } }] },
        caseStudyData,
      )
    }
  }

  async function seedBlogs() {
    console.log('\n→ Seeding Blogs...')

    for (const blog of blogsData.posts || []) {
      if (!blog.slug || !blog.date || !blog.richBody) {
        console.warn(`  Skipping blog without slug, published date, or body: ${blog.heading || blog.title}`)
        continue
      }

      const publishedDate = new Date(blog.date)
      if (Number.isNaN(publishedDate.getTime())) {
        console.warn(`  Skipping blog with invalid published date: ${blog.heading || blog.title}`)
        continue
      }

      const blogData = {
        title: blog.heading || blog.title || '',
        slug: blog.slug || '',
        heading: blog.heading || '',
        category: blog.category || '',
        dek: blog.description || blog.subheading || '',
        publishedDate,
        body: markdownToLexical(blog.richBody),
        tags: (blog.tags || []).map((t: string) => ({ tag: t })),
        seo: {
          seoTitle: blog.heading || '',
          metaDescription: blog.description || '',
          canonicalUrl: `https://www.canopyembedded.com/insights/${blog.slug}/`,
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
    if (hardwareItems.length === 0) {
      throw new Error('Checklist seed data does not contain hardware audit items')
    }

    const visibleItems = hardwareItems.slice(0, 3).map((item: any) => ({
      item: `${item.heading}: ${item.description}`,
    }))

    await findOrCreate(
      'checklist',
      { slug: { equals: 'hardware-audit-checklist' } },
      {
        title: checklistData.heading || checklistData.title,
        slug: 'hardware-audit-checklist',
        heading: checklistData.heading,
        subheading: checklistData.subheading,
        introduction: checklistData.body,
        itemsHeading: checklistData.itemsHeading,
        items: hardwareItems.map((item: any) => ({
          number: item.number,
          heading: item.heading,
          description: item.description,
          locked: Boolean(item.locked),
        })),
        accessGate: checklistData.accessGate,
        visibleItems,
        lockedItemsCount: Math.max(hardwareItems.length - visibleItems.length, 0),
        seo: {
          seoTitle: checklistData.htmlTitle || checklistData.heading || checklistData.title,
          metaDescription: checklistData.seo?.metaDescription || '',
          canonicalUrl: 'https://www.canopyembedded.com/resources/hardware-audit-checklist/',
          robots: { index: true, follow: true },
          schemaType: 'none',
        },
      },
    )
  }
}

main()

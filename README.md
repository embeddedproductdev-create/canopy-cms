# Canopy CMS Backend — Content Seeding & Testing

This guide covers testing the CMS schema extensions and running the seed script to populate Payload CMS with content.

## Quick Start

### 1. Generate Types (Local Only)
The sandbox blocks local port binding, so run this locally:

```bash
npm run generate:types:payload
```

This regenerates `src/payload-types.ts` with new globals and collection fields.

### 2. Create & Apply Migration

```bash
payload migrate:create
npm run deploy:database
```

### 3. Start Dev Server
In one terminal:

```bash
npm run dev
```

Wait for: `✓ Admin UI available at http://localhost:3000/admin`

### 4. Run Seed Script
In a second terminal:

```bash
npm run seed
```

Expected output:
```
✓ Connected to Payload
→ Seeding Media...
→ Seeding Globals...
→ Seeding Pages...
✓ Seeding complete!
```

### 5. Run Test & Coverage Report

```bash
npm run test:seed
```

This will output a comprehensive CLI report with:
- ✅ Global coverage table
- 📚 Collection count validation
- 📊 Seeded data coverage table
- 🟡 Placeholder detection ([TODO:] markers)
- 📝 Test summary with pass/fail/warn counts

### 6. Verify in Admin UI

Open `http://localhost:3000/admin` and check:

**Globals:**
- ✅ **SiteChrome** — 8 tabs (Primary CTA, Back Links, Empty States, Checklist UI, Checklist Modal, 404 Page, Nav Fallback)
- ✅ **Header** — navCta group added
- ✅ **Footer** — linkGroups array, contactInfo group, subHeading, cta

**Collections:**
- **Page** — 3 docs (About, Capabilities, Engagement Model) with new field groups: pills, cards, faqs, workflowSteps, relatedCaseStudies, teamMembers, companyFacts
- **Case Study** — 3 docs (Smart BMS, Charger, BLE Mesh Node) with projectStage, atAGlance, features, technicalSpecifications
- **Blog** — 3 posts with tags array
- **Checklist** — 2 checklists

## What Was Extended

### New Globals (1)
- **SiteChrome** — All UI chrome strings (CTAs, labels, modals, fallbacks)

### Extended Globals (2)
- **Header** — Added navCta group
- **Footer** — Replaced JSON categories with structured linkGroups, contactInfo, cta

### Extended Collections (3)
- **Page** — Added pills, cards, faqs, workflowSteps, relatedCaseStudies, teamMembers, companyFacts
- **CaseStudy** — Added projectStage, atAGlance, features, technicalSpecifications
- **Blog** — Added tags array

### Files Modified
- ✅ `src/globals/SiteChrome.ts` (215 lines)
- ✅ `src/globals/Header.tsx` (+11 lines)
- ✅ `src/globals/Footer.tsx` (+40 lines)
- ✅ `src/collections/Page.ts` (+60 lines)
- ✅ `src/collections/CaseStudy.ts` (+50 lines)
- ✅ `src/collections/Blog.ts` (+8 lines)
- ✅ `src/payload.config.ts` (registered SiteChrome global)
- ✅ `scripts/seed.ts` (completely rewritten)

## Seed Script Details

Uses upsert-by-natural-key pattern — safe to run multiple times.

**Seeds in order:**
1. Media (logos from Canopy-Website/public/)
2. Globals (SeoSettings, Header, Footer, SiteChrome, Home)
3. Pages (About, Capabilities, Engagement Model)
4. Case Studies (3 projects with specs)
5. Blogs (3 articles)
6. Checklists (2 checklists)

**Known Placeholders:** All content marked "unchanged from v83" in source uses `[TODO: ...]` markers. Edit these via admin UI later or leave for content team.

## Idempotency Check

```bash
npm run seed      # First run
npm run seed      # Second run — should show "Updated" instead of "Created"
```

## Test Failure Debugging

If `npm run test:seed` fails:

1. Ensure migration was applied: `payload migrate:status`
2. Check dev server is running on port 3000
3. Verify seed script completed without errors
4. Check for [TODO:] content in admin UI

## Next: Frontend Integration

Once backend testing passes, proceed to `../Canopy-Website/README.md` for frontend rewiring.

# Seeding Content in canopy-cms

This guide covers how to populate the Canopy Embedded Labs CMS with content for local development and testing.

## Prerequisites

Before running the seed script, ensure:

1. **Local Payload dev server is running:**
   ```bash
   cd /Users/2385610/Code/canopy/canopy-cms
   npm run dev
   ```
   The server starts on `http://localhost:3000` by default.

2. **Environment variables are set up:**
   - A valid `.env` file must exist in `canopy-cms/` with:
     - `PAYLOAD_SECRET=<random-hex-string>` (generate via `openssl rand -hex 32` if needed)
     - Cloudflare D1 database bindings (if using remote DB; local SQLite uses `./data/`)
   - For local development with SQLite, the defaults work fine.

3. **Wrangler bindings configured (for Cloudflare deployments):**
   - If deploying to Cloudflare, ensure `wrangler.toml` defines `d1_databases` and R2 bucket bindings.
   - For local dev, these are optional; SQLite is the fallback.

## Running the Seed Script

The seed script uses the **Payload Local API** (in-process, no HTTP) to insert content directly into the Payload CMS database.

### Important: How to Run

**The seed script must run ON YOUR MACHINE (not in a sandboxed environment).** Here are your options:

#### Option 1: Run Locally (Recommended)

In your terminal on your machine:

```bash
# Terminal 1: Start Payload dev server
cd /Users/2385610/Code/canopy/canopy-cms
npm run dev

# Terminal 2: Run seed script (once server is ready)
cd /Users/2385610/Code/canopy/canopy-cms
npm run seed
```

#### Option 2: Run via Script File

If `npm run seed` doesn't work in your environment:

```bash
cd /Users/2385610/Code/canopy/canopy-cms
cross-env NODE_OPTIONS="--no-deprecation --import=tsx/esm" node scripts/seed.ts
```

#### Option 3: Manual Seeding via Admin UI

If the automated script fails, seed content manually:

1. Open http://localhost:3000/admin
2. Go to each collection (Pages, Projects, Posts, etc.)
3. Click "Create New"
4. Fill in content using the content.md file as reference
5. Click "Save"

### What It Does

The script (`scripts/seed.ts`) seeds **globals** and **collections** in this order:

1. **Globals** (singular instances, app-wide):
   - `header` — main navigation menu
   - `footer` — footer content and links
   - `seo-settings` — robots.txt rules, indexing toggle, sitemap URL

2. **Collections** (documents, one per row):
   - `category` (5 items) — Insights categories (Firmware & OTA, PCB Design, BMS / EV, IoT, Industrial IoT)
   - `page` (8 items) — Homepage, About, 6 Capabilities pages, Engagement Model
   - `project` (3 items) — Smart BMS, Dual-Channel Charger, BLE Mesh + RS485 Node
   - `checklist` (2 items) — Hardware Audit Checklist, IoT App & Cloud Readiness Checklist
   - `post` (3 items) — Insights articles (Five Vendors One Product Zero Owners, Most Common IoT Support Ticket, Bootloader Recall Insurance)

### Expected Output

On success, you'll see one `✓` line per document inserted/updated:

```
[seed] Starting content seeding...
[seed] Seeding globals...
  ✓ Header updated
  ✓ Footer updated
  ✓ SEO Settings updated
[seed] Seeding categories...
  ✓ Created category "Firmware & OTA"
  ✓ Created category "PCB Design"
  …
[seed] Seeding homepage...
  ✓ Homepage updated
[seed] ✓ Seeding completed successfully
```

If anything fails, the script logs the error and exits with code 1. **The script is idempotent** — run it multiple times; it upserts by `url`/`slug`, so existing docs get updated instead of duplicated.

## Globals vs Collections

- **Globals** (`header`, `footer`, `seo-settings`) are singular, app-wide settings. View them in the admin UI at:
  - `/admin/globals/header`
  - `/admin/globals/footer`
  - `/admin/globals/seo-settings`

- **Collections** are tables of individual documents (pages, projects, posts, checklists, categories). View them at:
  - `/admin/collections/page`
  - `/admin/collections/project`
  - `/admin/collections/post`
  - `/admin/collections/checklist`
  - `/admin/collections/category`

## Verifying Content Landed

### In the Payload Admin UI (http://localhost:3000/admin)

1. **Check document counts:**
   - Pages: 8 (homepage, about, 6 capabilities, engagement-model)
   - Projects: 3
   - Posts: 3
   - Checklists: 2
   - Categories: 5

2. **Spot unconfirmed content (draft docs):**
   - Any document with `status: "draft"` won't appear in the public API or on the website until published.
   - These are placeholder docs with `[TODO: …]` notes — edit them in the admin UI to add real content.
   - Example: the About page team bio section is flagged as `[TODO: confirm team bio — Founder & CEO]`.

3. **Check globals:**
   - `/admin/globals/header` — main nav items (Capabilities, Portfolio, Engagement Model, Insights)
   - `/admin/globals/footer` — footer columns and copyright text
   - `/admin/globals/seo-settings` — `allowIndexing: true`, `sitemapUrl` set to the canopy-cms route

## Data Sources

**Confirmed Content:**
- Placeholder docs are seeded with content copied directly from `content.md` (the marketing spec).
- Any value marked `[TODO: …]` in the CMS requires you to fill in real data — these appear **only in draft mode**, not live.

**Unconfirmed / Missing Content (to be filled in by you):**
- About page: real team names, photos, one-line bios
- BMS project: voltage range, cell-balancing method, dimensions, weight, temperature range, IP rating, certifications
- Charger & BLE node: full spec sheets (beyond the deck's at-a-glance figures)
- Sources: links to the 21,000-vehicle recall news article, and citation for the $7–8.5B ISO 13485 figure
- Mechanical workflow & materials list: confirm against real design process
- Engagement Model: minimum-engagement FAQ copy (beyond the 6-step process)
- Checklists: PDF assets and email delivery workflow (form integration)

## Troubleshooting

### "Connection refused" or "ECONNREFUSED"
The dev server isn't running. In a separate terminal, run:
```bash
cd /Users/2385610/Code/canopy/canopy-cms
npm run dev
```
Then re-run the seed script.

### "D1 database not found" or ".env not set"
- Ensure `.env` exists in `canopy-cms/` with `PAYLOAD_SECRET=<value>`.
- For local dev with SQLite, no other env vars are required; the script uses an in-process DB.
- If deploying to Cloudflare, ensure `wrangler.toml` defines your D1 database binding.

### "Cannot find module" errors
The Payload config or seed script can't find a collection. Check:
1. The collection file exists under `src/collections/` (e.g., `Post.ts`).
2. It's registered in `src/payload.config.ts` (e.g., `collections: [User, Media, Page, Section, Card, Project, Post, Category, Checklist]`).
3. Re-run `npm run generate:types` to regenerate TypeScript types if you added a new collection.

### Seed script hangs / never completes
- Check that the dev server didn't crash; look for errors in its terminal.
- The Payload Local API blocks until all data operations complete, so large batches take a moment—give it 30 seconds before interrupting.
- If it's stuck past 30 seconds, kill the dev server and seed script, then restart both.

## Re-seeding

It's safe to run `npm run seed` multiple times. The script checks for existing docs by `url`/`slug` and updates them instead of creating duplicates. This is useful if you:
- Edit a placeholder doc in the admin and want to revert to the seeded template
- Want to re-run after fixing env vars or database issues

## Next Steps

Once seeded, you're ready to:

1. **Test the website build:**
   ```bash
   cd /Users/2385610/Code/canopy/Canopy-Website
   npm run build
   ```
   This prerender all pages using the live CMS data and generates `dist/canopy/browser/`.

2. **Edit content in the admin:**
   Visit `http://localhost:3000/admin`, edit any document, and click **Publish**. The changes are live immediately for the API endpoints and will appear on the website after the next build.

3. **Populate missing fields:**
   For any placeholder marked `[TODO: …]`, edit it in the admin and replace with real data. Once done, set `status: published` so it appears on the site.

## Support

If you run into issues not covered here:
- Check the Payload documentation: https://payloadcms.com/docs
- Review the seed script itself: `scripts/seed.ts` — it's heavily commented
- Verify the CMS schema: `src/payload.config.ts` lists all collections and their fields

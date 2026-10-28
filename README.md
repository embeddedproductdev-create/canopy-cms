# Canopy CMS

Content management for the Canopy Embedded Labs website. Payload CMS v3 on Next.js 15, deployed as a Cloudflare Worker (OpenNext) with a D1 (SQLite) database and an R2 bucket for media. The Angular website lives in a separate repository (`canopy-Website`) and reads content from this CMS over its REST API.

| Layer | Technology |
|---|---|
| CMS / admin | Payload 3.82, Lexical rich text |
| Runtime | Next.js 15 on Cloudflare Workers via `@opennextjs/cloudflare` |
| Database | Cloudflare D1 (`canopy-cms-db`), SQLite locally |
| Media | Cloudflare R2 (`canopy-cms-r2-bucket`) in production, `./media` locally |
| Tooling | Node.js >= 24.15, npm, Vitest, ESLint, Wrangler 4 |

## 1. Run it locally

### Prerequisites
- Node.js 24.15 or newer and npm.
- Git. No Cloudflare account is needed for local work.

### Steps
```bash
git clone <this-repo-url> canopy-cms
cd canopy-cms
npm ci
npm run dev                     # http://localhost:3000
```

- Copy `.env.example` to `.env` and set `PAYLOAD_SECRET` before the first start.
- Admin panel: http://localhost:3000/admin. On a fresh, unseeded local database, create the first admin user in Payload's setup screen.
- Seeding is optional. Run `npm run seed:local` only when you intentionally want the bundled sample content and media.
- Open the site and admin through `localhost`, not `127.0.0.1`. CORS and CSRF only allow `http://localhost:3000` and `http://localhost:4200` (plus the production addresses listed in `allowedOrigins` in `src/payload.config.ts`).
- `npm run dev` first applies the registered migrations and repairs draft-version tables when needed. It does not seed or drop local content.
- The website (port 4200) expects this CMS on port 3000. See the website repository's README.

### Environment variables
| Variable | Where | Purpose |
|---|---|---|
| `PAYLOAD_SECRET` | `.env` locally, Worker secret in production | Signs logins. Required. Never change it after go-live, or every session and API key stops working. |
| `PAYLOAD_PUSH` | optional, local only | `true` lets Payload push schema changes. Leave it off; use migrations. |
| `NOTIFY_*`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_AUTH_TOKEN`, `DEPLOY_HOOK_URL` | optional | Form-submission notifications and cache purge. Not configured by the deploy workflow today. See `NOTIFICATIONS.md`. |

### Commands
| Command | What it does |
|---|---|
| `npm run dev` | Prepare the local schema, then `next dev` on :3000 |
| `npm run seed:local` | Import `seed/` (database and media) into the local environment |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |
| `npm run test:int` | Vitest integration tests (migrations, URL normaliser, ...) |
| `npm run generate:types:payload` | Regenerate `src/payload-types.ts` after changing collections or globals |
| `npm run generate:importmap` | Regenerate the admin import map after adding or changing admin components |
| `npm run docs:cms` | Regenerate `CMS-GUIDE.md` (every field, the section layout matrix and the conditional-field rules) |
| `npm run apply:cleanup` | Apply the content migration to the remote D1 once (the deploy workflow runs it; safe to repeat) |
| `npm run build:cf` | Production Worker build (what the deploy workflow runs) |
| `npm run deploy:database` | `payload migrate` against the remote D1 (needs Cloudflare credentials) |
| `npm run verify:remote` | Fails if a migration is unapplied or the remote has no pages or admin user |
| `npm run sync:db`, `npm run sync:media` | Export your local database or media to the remote from your own machine (advanced; the seed workflow normally does this) |
| `npm run notify:test` | Send a test notification |

## 2. Project layout
```
src/collections/   Page, Section, Card, Capability, Industry, CaseStudy (Portfolio), Blog (Insights), Checklist,
                   Testimonial, FormSubmission, Media, User
src/globals/       Header, Footer, SeoSettings, SiteChrome (UI labels)
src/migrations/    Idempotent migrations, registered in index.ts
src/hooks/         URL normaliser, checklist redaction, cache revalidation
src/components/admin/   Admin logo, icon, notification bell
scripts/           prepare-dev-schema, verify-remote-migrations, sync-*, notify-test
seed/              db-dump.sql and media/ used to fill a fresh database and bucket
wrangler.jsonc     Worker name, D1 and R2 bindings
.github/workflows/ seed-cms.yml and deploy-cms.yml
```

**How to use the admin and what every field does: [CMS-GUIDE.md](CMS-GUIDE.md).** Pick a Section Type and the form shows only the fields that layout reads.

Content model: Pages retain their flexible `Section` / `Card` layout. Capabilities, Industries, Portfolio projects, and Insights are edited from their own collection forms using direct fields; legacy Section/Card relationships stay available to the public API for existing content but are hidden from the routine admin workflow.

### Content JSON transfer

The **Import / Export** link in the admin navigation transfers Insights, Portfolio, or Capabilities as `canopy-content-v1` JSON. Imports validate and preview records before any changes are made. After explicit confirmation, documents are matched by slug: matching records are updated, and unmatched slugs are created. Image references are resolved by media filename, so the corresponding media must already be uploaded to the target CMS.

### Changing the schema
1. Edit the collection or global.
2. Add an idempotent migration in `src/migrations/` and register it in `src/migrations/index.ts`.
3. `npm run generate:types:payload`.
4. `npm run lint`, `npx tsc --noEmit`, `npm run test:int`.
5. Apply the migration to the remote D1 yourself (`npm run deploy:database` with Cloudflare credentials in your shell), then commit and run the deploy workflow. The workflow does not run migrations: `payload migrate` needs a Cloudflare remote preview session that the GitHub runner could not create, and the verify step stops the deploy if a migration is still unapplied.

Never rely on schema push in production, and never accept a prompt that drops populated tables.

## 3. Deploy to Cloudflare (GitHub Actions)

Everything is manual: **Actions -> choose the workflow -> Run workflow**. Each workflow is one job in the `production` environment and uses no artifacts.

### One-time setup
1. **Cloudflare API token** (My Profile -> API Tokens -> Custom) with: Account / Workers Scripts: Edit, Account / D1: Edit, Account / Workers R2 Storage: Edit. Note your **Account ID**.
2. The D1 database (`canopy-cms-db`, id in `wrangler.jsonc`) must exist. The R2 bucket is created by the seed workflow if missing.
3. **GitHub secrets** (Settings -> Secrets and variables -> Actions -> Secrets):

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | token from step 1 |
| `CLOUDFLARE_ACCOUNT_ID` | account id |
| `PAYLOAD_SECRET` | long random string (`openssl rand -hex 32`); keep it forever |
| `CMS_URL` | `https://canopy-cms.<your-workers-subdomain>.workers.dev`. The subdomain is shown under Cloudflare -> Workers & Pages -> Account details |

4. Optionally add required reviewers to the `production` environment for an approval gate.
5. Keep this repository **private**: `seed/db-dump.sql` contains the admin password hash.

### First deploy, in this order
1. **Seed CMS Database and Media** (`seed-cms.yml`): imports `seed/db-dump.sql` into the remote D1 (skipped with a warning if the database already has tables), creates the R2 bucket if missing, uploads `seed/media/*` to it, and runs the remote verification. Both steps are selectable when you run it.
2. **Deploy CMS to Cloudflare** (`deploy-cms.yml`).
3. Deploy the website (its own repository and README).
4. If the website gets a new address, add it to `allowedOrigins` in `src/payload.config.ts` and rerun **Deploy CMS to Cloudflare**.

### What the deploy workflow does
| Step | Purpose |
|---|---|
| Verify credentials | all required secrets present, `wrangler whoami` |
| Lint, type check, integration tests | a broken commit never reaches production |
| Record D1 bookmark | logs the Time Travel bookmark taken before the migrations |
| Apply content migration | `npm run apply:cleanup` records and applies the content migration on the remote D1 (no preview session needed) |
| CMS guide check | `CMS-GUIDE.md` must match what `npm run docs:cms` generates |
| Verify remote | every migration in the code is already applied to the remote D1 (the seed marks all current ones applied); pages and admin user exist. The workflow fails here if you add a migration without applying it |
| Build | `npm run build:cf` (`PAYLOAD_USE_LOCAL_BINDINGS=true`, so the build never opens a Cloudflare session) |
| Worker size | gzipped `handler.mjs` must stay under 10 MB |
| Deploy | `wrangler deploy` (bindings come from `wrangler.jsonc`) |
| Runtime secrets | sets `PAYLOAD_SECRET` on the Worker |
| Smoke check | `/admin`, `/api/globals/header`, `/api/page`, `/api/capability` respond; pages exist; first media file returns 200 |

Later deploys: just run **Deploy CMS to Cloudflare** again.

### Media and the repository
`seed/media/` is in git only so the seed workflow can fill an empty R2 bucket without running Wrangler on your machine. After the first seed you can stop caring about it: files uploaded through the production admin go straight to R2 and are never written back to git. Do not re-run the seed to "sync" production content; it skips a database that already has tables and would only re-upload old media.

To refresh the seed from your local content (rarely needed):
```bash
SYNC_EXCLUDE=form_submission npm run sync:db      # writes .sync/db-dump.sql (dry run); copy it to seed/db-dump.sql
cp -r media/. seed/media/
```

### Rollback
- Worker: `npx wrangler rollback`, or Cloudflare dashboard -> Workers -> canopy-cms -> Deployments -> Rollback.
- Database: use the bookmark printed in the workflow log: `npx wrangler d1 time-travel restore canopy-cms-db --bookmark=<bookmark>` (or `--timestamp=<ISO time>`), then redeploy the previous commit.

### Troubleshooting
| Symptom | Likely cause |
|---|---|
| *Verify credentials* fails | a required secret is missing |
| migrate cannot reach D1 | token lacks D1: Edit, or wrong account id |
| *Verify remote* fails | seed workflow not run yet, or a migration did not apply |
| images 404 | media not uploaded: rerun the seed workflow with only `upload_media` |
| browser CORS/CSRF errors from the site | website origin missing from `allowedOrigins` in `src/payload.config.ts`; add it and redeploy |
| production admin: collections show a 500 error, the bell request returns 401 | the CMS's own origin (`https://canopy-cms.<subdomain>.workers.dev`) must stay in `allowedOrigins` in `src/payload.config.ts`. Payload ignores the login cookie on any request whose `Origin` is not in the CSRF list, so the admin's own saves and list loads fail. A test (`tests/int/origins.int.spec.ts`) guards this |
| local dev: "no such table" or missing columns | start from a clean state: delete `.wrangler/state`, run `npm run seed:local` |
| build asks for Cloudflare login | use `npm run build:cf`, not a bare `opennextjs-cloudflare build` |

## 4. Optional: form notifications and cache purge
New form submissions can notify Telegram, email (Resend) or a Discord/Slack webhook, and content changes can purge the Cloudflare cache or call a deploy hook. These are driven by environment variables (`NOTIFICATIONS.md`) and are **not** set by the deploy workflow yet. To enable them, add the secrets and extend the *Set Worker runtime secrets* step in `deploy-cms.yml` with a `wrangler secret put` for each.

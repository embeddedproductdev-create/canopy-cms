# Canopy CMS: working rules

Payload 3 + Next 16 on Cloudflare Workers (OpenNext), D1 database, R2 media. Deployed by `.github/workflows/deploy-cms.yml`, which builds from what is pushed to GitHub. See `README.md` and `docs/RESOURCE-LIMITS.md`.

## Verify every CMS change before it is deployed

This applies to any change to collections, globals, migrations, `payload.config.ts`, `next.config.ts`, `wrangler.jsonc`, the workflow, `scripts/`, the seed, or dependencies. Do not tell the user a CMS change is ready to deploy until you have done all of the following and reported the result:

1. Follow the TDD rules in the user's global instructions (failing test first).
2. Run `npm run predeploy`. It type-checks, runs the full integration suite, regenerates the import map, Payload types, `CMS-GUIDE.md`, `CONTENT-MAP.md` and `scripts/lib/expected-schema.json` (a changed file means it was stale, so commit it), checks the local database against the code, and lists new files that are not committed yet.
3. If the change touches the schema, a migration, the seed or `replace:db`, rehearse the deploy flow on a fresh local database: `npm run seed:local`, then `npm run replace:db -- --local --yes` **twice** (a second run is what a re-deploy does), then `npm run apply:cleanup -- --local`, then `npm run verify:remote -- --local`, then open the admin lists (Portfolio, Insights, Capabilities, Pages) and confirm they show rows. A list that renders blank means the database does not match the code.
4. If the change affects the build, dependencies or Worker config, build on Linux like CI does (`npm ci`, `npm run build:cf`, the gzip size gate in the workflow, `npx wrangler deploy --dry-run`). A Windows `build:cf` cannot be used (symlink permissions).
5. End the report with what was **not** verified. The steps that need Cloudflare credentials cannot be run here: the credential check, the D1 time-travel bookmark, the real remote `replace:db`, the R2 upload, the real `apply:cleanup` and `verify:remote`, `wrangler deploy`, the secrets push and the smoke check.

Everything the workflow needs must be committed and pushed: a file that exists only on this machine makes CI fail with "Cannot find module". Check `git status` for untracked source files.

## When a deployment fails

Fix the cause, then add a row to the table below and add a test or a `predeploy` check that would have caught it. Do not just fix it and move on.

## Before the first deploy of a change set

- Cloudflare account: **R2 enabled** and **Workers Paid** (`limits.cpu_ms` is refused on Free).
- GitHub `production` environment secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `PAYLOAD_SECRET`, `CMS_URL`. Optional: `NOTIFY_TELEGRAM_BOT_TOKEN`, `NOTIFY_TELEGRAM_CHAT_ID`, `NOTIFY_ADMIN_URL`.
- Deploy order when the website form changes: website first, then the CMS (the CMS rejects a consultation without a mobile number).
- Leave `replace_database` off to keep the content already edited in the live CMS; turn it on only to reset the content to `seed/db-dump.sql`. Tick `upload_media` the first time R2 is used.

## Deployment error log

| Error seen | Cause | What now prevents it |
|---|---|---|
| OpenNext: "Next.js 15.4.11 is not supported" | Next too old for `@opennextjs/cloudflare` | Next 16.4.3, Payload 3.92.1, OpenNext 1.20; Linux `build:cf` in the checklist |
| `replace:db` fails with `SQLITE_AUTH` | Queries touched D1's protected `_cf_*` tables | Every schema query filters `NOT LIKE '_cf_%'` (replace, migrations, schema check) |
| Migration wrote the text `"null"` into a column | wrangler `--json` returns `NULL AS x` as text | Migrations select only real columns |
| `Could not resolve drizzle-kit-<hash>` | Next 16 builds with Turbopack by default | `--webpack` in `open-next.config.ts` and the npm scripts |
| `SQLITE_BUSY` during build or tests | Several processes opened the same local D1 | `experimental.cpus: 1`, vitest `fileParallelism: false` |
| Admin failed after Payload upgrade | Payload 3.92 expects `user.reset_password_requested_at` | Migration `20261031`; schema check in `verify:remote` |
| `wrangler deploy`: "enable R2 through the Cloudflare Dashboard" (10136) | R2 not enabled on the account | Prerequisite list above |
| `replace:db`: `{"D1_RESET_DO":true}` | One huge import was too heavy for D1 | Chunked import with retries and a row-count check |
| Portfolio list in the admin blank, no browser error | Deployed code expects tables or columns the live database lacks | `verify:remote` compares every expected table and column (`scripts/lib/expected-schema.json`); run `apply:cleanup` |
| `replace:db` fails on the second run: "no column named ..." | Kept `user` / `form_submission` rows have columns added by later migrations that the seed lacks | `buildReplaceChunks` adds those columns before restoring the rows; test in `replace-remote-db.int.spec.ts` |
| `replace:db` row-count check: "too many terms in compound SELECT" (found in the local rehearsal, before it could fail a deploy) | D1 allows only a few terms in a compound SELECT | `countStatements` sends one simple SELECT per table; test in `replace-remote-db.int.spec.ts` |
| "Worker exceeded resource limits" (1102) | One request used too much CPU or memory | Observability logs, `limits.cpu_ms`, `maxDepth` 3, 25-row admin lists, 10 MB uploads, 100-record imports, no GraphQL |

Known gap: `seed/media` lacks three real content images (blog cover and two project cards), so those show broken until they are uploaded.

# Seeding canopy-cms

The seed script bootstraps CMS globals and content from the JSON sources in `seed-data/`. The website reads the resulting content from the Payload API; it does not use these files as browser-side fallbacks.

## Before running the seed

1. Install the CMS dependencies and configure the environment variables required by `payload.config.ts`.
2. Check which database the current environment is configured to use. The seed script uses Payload's configured database and updates existing seed-managed documents by their URL or slug; do not assume it is pointed at a local database.
3. Confirm that updating the seed-managed content in that database is intended.

For local development, start the CMS from this directory:

```bash
pnpm install
pnpm run dev
```

The local API is normally available at `http://localhost:3000`. Use `localhost` (not `127.0.0.1`) for the website origin unless the CMS CORS/CSRF configuration is changed.

## Run the seed

From `canopy-cms/`:

```bash
pnpm run seed
```

The script connects to Payload through its Local API and seeds media, globals, pages and their related sections/cards, case studies, blogs, checklists, and testimonials. It reports created or updated records and exits with an error when seeding fails.

The operation is repeatable for records matched by URL or slug, but it is not a content-preservation workflow: seed-managed fields are updated from `seed-data/`. Edit the source files and review the resulting CMS changes before reseeding. Never run it against a production database unless that update has been explicitly planned.

## Verify

With the local CMS running, check that the public API responds and includes the seeded content, for example:

- `http://localhost:3000/api/page?limit=1`
- `http://localhost:3000/api/case-study?limit=1`
- `http://localhost:3000/api/blog?limit=1`
- `http://localhost:3000/api/checklist?limit=1`
- `http://localhost:3000/api/globals/site-chrome`

Then start the website from `canopy-Website/` with `npm start` and open `http://localhost:4200/`. The CMS API must permit that website origin in its CORS and CSRF settings.

## Troubleshooting

- **Connection or database errors:** check the CMS process output, `.env`, and the database binding configured for the current environment.
- **Missing or outdated page content:** check the source file in `seed-data/`, the corresponding Payload schema, and the document's publication status. Rerun the seed only after confirming the target database.
- **Browser CORS errors:** verify that the website is loaded from `http://localhost:4200` and that this origin is allowed by Payload.
- **Schema changes:** update the relevant collection/global definition, regenerate Payload types when needed, then reseed the intended database.

For frontend setup and SPA build instructions, see [`../canopy-Website/README.md`](../canopy-Website/README.md).

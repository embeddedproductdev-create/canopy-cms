# Worker resource limits

Cloudflare error 1102 ("Worker exceeded resource limits") means one request used more CPU time or memory than a Worker may. On the Workers Paid plan the CPU limit is 30 s by default (this project raises it to 5 min with `limits.cpu_ms` in `wrangler.jsonc`) and memory is a fixed 128 MB per isolate.

## Finding the cause
Invocation logs are enabled (`observability` in `wrangler.jsonc`, 100 % sampling).

1. Cloudflare Dashboard -> Workers & Pages -> `canopy-cms` -> **Logs**, filter by outcome `Exceeded Resources`, or run `npx wrangler tail`.
2. Note the URL and the message: `Exceeded CPU Limit` or `Exceeded Memory`.
3. Metrics tab: CPU time p99 and request count per route show whether it is one heavy route or sheer volume.

## What keeps requests small (already in the code)
| Control | Where | Value |
|---|---|---|
| Populate depth | `maxDepth` in `src/payload.config.ts` | 3 |
| Admin list size | `admin.pagination` on every collection | 25 per page (10, 25, 50) |
| Upload size | `upload.limits.fileSize` | 10 MB |
| Import size | `MAX_IMPORT_RECORDS` (`src/utilities/transferLimits.ts`) and 5 MB | 100 records |
| GraphQL | disabled (the website uses REST only) | off |
| Sitemap | `src/utilities/sitemapQuery.ts` loads only url, slug, updatedAt, seo | depth 0 |
| Browser/edge cache | `next.config.ts` headers | public content 60 s (edge 300 s), media 1 h (an error response is cached for the same time, so it is kept short) |

Public cache headers are skipped for requests that carry the admin login cookie, so editors always see fresh data. `tests/int/resource-limits.int.spec.ts` guards all of the above.

## Moving to a custom domain (planned)
Cache API and edge caching do not work on `*.workers.dev`; they do on a custom domain in a Cloudflare zone. The `s-maxage` values above start working there with no code change. When switching:

1. Add the domain (`routes` or a custom domain) to the Worker in `wrangler.jsonc`.
2. Add the new origin to `allowedOrigins` in `src/payload.config.ts` and to `tests/int/origins.int.spec.ts` (CORS and CSRF).
3. Update the GitHub secrets `CMS_URL` (CMS smoke check and the website build) and `NOTIFY_ADMIN_URL`, set `NEXT_PUBLIC_SERVER_URL`, then redeploy the CMS and rebuild the website.
4. Set `CLOUDFLARE_ZONE_ID` and `CLOUDFLARE_AUTH_TOKEN` so `src/hooks/revalidate.ts` purges `/api/*` after each edit.
5. Add a Cache Rule: cache `GET /api/*`, bypass `/admin*`, `/api/users*` and `/api/form-submission*`.
6. Optional: serve media from R2 through a public custom domain so images stop invoking the Worker.
7. Only if the logs still show admin memory pressure: run the admin on its own Worker.

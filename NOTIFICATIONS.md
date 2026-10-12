# Form-submission notifications (zero cost)

Every submission from the website forms (engagement, checklist unlock, subscribe, consultation) is saved in the CMS
(**Form Submissions** + the bell icon in the admin). The CMS can *also* push a message to you the moment a new one
arrives. Nothing is sent unless you set the environment variables of a channel below — pick one or combine several.

How it works: `FormSubmission` collection → `afterChange` hook (`src/hooks/notifySubmission.ts`) → adapters in
`src/lib/notify/`. It runs in the background (`waitUntil` on Cloudflare) so visitors never wait, a failing channel
never breaks a submission, and it only fires for **new** submissions (not edits, archive/restore).

> The static Cloudflare Pages *preview* build has no CMS: its forms are simulated, so no notifications are sent there.

## At a glance

| Option | Cost | Free limit | Setup time | You need | Best for |
|---|---|---|---|---|---|
| **Telegram bot** | $0 | Effectively unlimited (≈30 msg/s) | 5 min | Telegram account, bot token, chat id | Instant phone push |
| **Email via Resend** | $0 | 3,000/month, 100/day (free plan) | 10–20 min | Resend account, API key, a sender address (own domain for any recipient; `onboarding@resend.dev` only to your own signup email) | Inbox copy you can reply to |
| **Discord / Slack webhook** | $0 | Rate-limited, far above form volume | 3 min | A Discord server (or Slack workspace) + channel | Team channel / shared log |
| **Cloudflare Email Routing (`send_email`)** | $0 | Per Cloudflare Email limits | 30+ min | Domain on Cloudflare, Email Routing enabled, **verified** destination address, Worker binding change | No third-party service at all |

Recommendation: **Telegram** (fastest, most reliable, truly instant) and optionally **Resend** for an email copy.

## Common to all channels
- Secrets are environment variables, never stored in the CMS database or the website bundle.
  - Local development: add them to `canopy-cms/.env` and restart `pnpm run dev`.
  - Cloudflare Workers: `pnpm exec wrangler secret put NOTIFY_TELEGRAM_BOT_TOKEN` (one command per variable), then redeploy.
- `NOTIFY_ADMIN_URL` (optional, e.g. `https://cms.example.com`) adds an "Open:" link to the admin record in each message.
- Test any time: `pnpm run notify:test` sends a sample through every channel that is configured (exits non-zero if one fails).
- Failures are logged as `[notify:<channel>] …` in the CMS console / Workers logs.

## Option 1 — Telegram bot (recommended)
Dependencies: a Telegram account only. No domain, no server.
1. In Telegram open **@BotFather** → `/newbot` → follow the prompts → copy the **bot token** (`123456:ABC…`).
2. Open a chat with your new bot and press **Start** (a bot can only message you after you wrote to it). For a group, add the bot to the group.
3. Get the chat id: open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser after sending the bot a message; read `result[0].message.chat.id` (groups have negative ids).
4. Set:
   ```
   NOTIFY_TELEGRAM_BOT_TOKEN=123456:ABC…
   NOTIFY_TELEGRAM_CHAT_ID=987654321
   ```
5. `pnpm run notify:test`.

Limits/notes: messages are plain text (4096 chars max; the hook trims). The token grants posting rights — treat it like a password; regenerate with `/revoke` in BotFather if it leaks.

## Option 2 — Email with Resend (free tier)
Dependencies: a free Resend account (resend.com), an API key, and a sender.
1. Create an account → **API Keys** → create a key with *Sending access*.
2. Sender address:
   - **Quick test:** `NOTIFY_EMAIL_FROM="Canopy <onboarding@resend.dev>"` — Resend only delivers this sender to the email you signed up with.
   - **Production:** add and verify your domain in Resend (adds 2–3 DNS records: SPF, DKIM, optional DMARC), then use e.g. `Canopy CMS <notify@yourdomain.com>`; you can then send to any recipient.
3. Set:
   ```
   NOTIFY_RESEND_API_KEY=re_…
   NOTIFY_EMAIL_FROM=Canopy CMS <notify@yourdomain.com>
   NOTIFY_EMAIL_TO=contactsuriyas@gmail.com            # comma-separated for several
   ```
4. `pnpm run notify:test`. The email's *Reply-To* is the visitor's address, so you can answer straight from your inbox.

Limits/notes: free plan = 3,000 emails/month and 100/day (plenty for form leads). Check spam on first delivery.

## Option 3 — Discord or Slack webhook
Dependencies: a Discord server or Slack workspace you control.
- **Discord:** channel settings → *Integrations* → *Webhooks* → *New Webhook* → copy URL.
  ```
  NOTIFY_WEBHOOK_URL=https://discord.com/api/webhooks/…
  NOTIFY_WEBHOOK_TYPE=discord
  ```
- **Slack:** create an app → *Incoming Webhooks* → activate → *Add New Webhook to Workspace* → copy URL.
  ```
  NOTIFY_WEBHOOK_URL=https://hooks.slack.com/services/…
  NOTIFY_WEBHOOK_TYPE=slack
  ```
  (`slack` is also the right choice for Mattermost/Rocket.Chat style `{ text }` webhooks.)

Notes: the webhook URL is a secret (anyone with it can post). Discord messages are capped at 2000 chars (trimmed).

## Option 4 — Cloudflare Email Routing `send_email` (not wired in code)
Dependencies: your domain's DNS on Cloudflare, **Email Routing** enabled, the destination mailbox added and **verified** under *Email → Destination addresses*, and a Worker `send_email` binding. Cloudflare only lets a Worker send to verified destination addresses, which is fine for notifying yourself.
1. Enable Email Routing for the domain (adds MX/SPF records).
2. Add + verify the destination (click the link Cloudflare emails you).
3. In `wrangler.jsonc` add:
   ```jsonc
   "send_email": [{ "name": "NOTIFY_EMAIL", "destination_address": "you@example.com" }]
   ```
4. Add a small adapter that builds an RFC-5322 message (needs the `mimetext` package) and calls `env.NOTIFY_EMAIL.send(...)`.
This needs code + a deploy-time binding, so it is documented but **not implemented**. Ask if you want it added.

## What each message contains
Form type, name, email, company, scope, message, checklist slug, page it was sent from, and (if `NOTIFY_ADMIN_URL` is set) a link to the record. Only the fields visitors typed — nothing else is collected.

## Troubleshooting
| Symptom | Check |
|---|---|
| Nothing arrives, no log lines | The variables are not set in the running process (restart the CMS; on Workers use `wrangler secret put` and redeploy). `pnpm run notify:test` prints which channels are enabled. |
| `[notify:telegram] 400 chat not found` | You never pressed *Start* on the bot, or the chat id is wrong (groups are negative numbers). |
| `[notify:telegram] 401` | Wrong or revoked bot token. |
| `[notify:resend] 403 / 422` | Sender domain not verified, or using `onboarding@resend.dev` to a recipient other than your signup email. |
| `[notify:webhook] 404` | The webhook was deleted; create a new one. |
| Works in `notify:test`, not for real forms | Submissions are rejected before saving (missing fields / 30-second repeat limit): see the 400/429 response in the browser network tab. |

# Telegram notifications for "Talk to an Engineer"

Every time someone submits the **Talk to an Engineer** popup, the CMS sends a message to a Telegram group. No email service is involved, so there is no cost.

```
Visitor submits popup  ->  POST /api/form-submission (CMS)  ->  saved in the CMS
                                                            ->  Telegram Bot API  ->  your team group
```

A failed Telegram call never blocks the submission: the entry is still saved and the error is logged.

## What the alert contains

```
New website submission — consultation
Name: Ada Lovelace
Email: ada@example.com
Phone: +91 98765 43210
Company: Analytical Engines
Role: Founder
Slot: Tuesday, Nov 3 · 10:00
Message: We need a BMS review.
Page: /work/smart-bms
Open: https://<cms-url>/admin/collections/form-submission/12
```

Lines for values that were not submitted are left out. `Open:` appears only when `NOTIFY_ADMIN_URL` (or `NEXT_PUBLIC_SERVER_URL`) is set.

## Part 1 - Create the bot (2 minutes)

1. In Telegram, open **@BotFather** and send `/newbot`.
2. Give it a name (for example `Canopy Leads`) and a username ending in `bot` (for example `canopy_leads_bot`).
3. Copy the **bot token** (`123456789:AAE...`). Treat it like a password. If it leaks, send `/revoke` to BotFather.

## Part 2 - Create the group and get its chat id

1. Create a Telegram **group** with everyone who should receive alerts.
2. Add your bot to the group (group info -> Add members -> search the bot username).
3. Send any message in the group, for example `hello`.
4. Open this URL in a browser (replace `<TOKEN>`):
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
5. Find `"chat":{"id":-100xxxxxxxxxx, ...}` in the result and copy that number. Group ids are **negative**; keep the minus sign.

If `result` is empty, send another message in the group and reload. If the bot has privacy mode on, mention it once (`@canopy_leads_bot hi`).

To add or remove people later, just change the group membership in Telegram. Nothing needs redeploying.

## Part 3 - Test locally

1. In `canopy-cms/.env` add:
   ```
   NOTIFY_TELEGRAM_BOT_TOKEN=123456789:AAE...
   NOTIFY_TELEGRAM_CHAT_ID=-100xxxxxxxxxx
   NOTIFY_ADMIN_URL=http://localhost:3000
   ```
2. Run `npm run notify:test`. A test message should arrive in the group.
3. Start the CMS (`npm run dev`) and the site (`npm start` in `canopy-Website`), open the site, click **Talk to an Engineer**, fill in all fields (including the mobile number) and submit. An alert should arrive within a few seconds.

Do not commit `.env`.

## Part 4 - Deploy

The CMS deploy workflow (`.github/workflows/deploy-cms.yml`) pushes the secrets to the Cloudflare Worker for you.

1. In GitHub open the **canopy-cms** repo -> Settings -> Environments -> **production** -> Environment secrets.
2. Add:

   | Secret | Value |
   |---|---|
   | `NOTIFY_TELEGRAM_BOT_TOKEN` | the bot token |
   | `NOTIFY_TELEGRAM_CHAT_ID` | the negative group chat id |
   | `NOTIFY_ADMIN_URL` (optional) | your deployed CMS URL, for the `Open:` link |

3. Run the **Deploy CMS** workflow. The step *Set Worker runtime secrets* uploads them. Any secret that is not set is skipped with a notice.
4. The same deploy applies the database migration `20261101_000000_form_submission_phone`, which adds the `phone` column. Nothing else to run.

Manual alternative (without the workflow), from `canopy-cms`:
```
npx wrangler secret put NOTIFY_TELEGRAM_BOT_TOKEN
npx wrangler secret put NOTIFY_TELEGRAM_CHAT_ID
npx wrangler secret put NOTIFY_ADMIN_URL
```
Secrets take effect on the next request; a redeploy is not required.

The website needs no change for notifications. Deploy it as usual so the new popup field goes live.

## Part 5 - Verify in production

1. Open the live site, click **Talk to an Engineer** and submit a test request.
2. Check that the group received the alert and that the entry appears in the CMS under **Form Submissions** with the phone number.
3. Delete the test entry in the CMS.

## Popup field rules

- Mobile number is **required** for the consultation form and must be 7-15 digits (`+`, spaces, dashes, dots and brackets are allowed). It is validated in the popup and again in the CMS.
- Optional label overrides in the CMS UI labels: `modal.field.phone` (default "Mobile number") and `modal.error.phone`.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Entry saved, no Telegram message | Secrets missing on the Worker. Check the *Set Worker runtime secrets* step log, then Worker logs (`npx wrangler tail`) for `[notify:telegram]`. |
| `[notify:telegram] 400 chat not found` | Wrong chat id, or the bot is not in the group. Keep the minus sign. |
| `[notify:telegram] 401` | Wrong or revoked bot token. |
| `[notify:telegram] 403` | The bot was removed from the group or blocked. Add it again. |
| `getUpdates` returns an empty result | Send a new message in the group first (and mention the bot if privacy mode is on). |
| Popup says "Please wait a moment before submitting again" | The CMS allows one submission per email per 30 seconds. |
| Popup rejects the number | It must contain 7-15 digits and only digits, `+`, spaces, `-`, `.`, `(`, `)`. |
| Group became a supergroup and alerts stopped | The chat id changed (it now starts with `-100`). Fetch it again with `getUpdates` and update the secret. |

## Related files

- `src/lib/notify/index.ts` - Telegram channel and message format
- `src/hooks/notifySubmission.ts` - runs the alert after a submission is created
- `src/collections/FormSubmission.ts` - submission fields and validation
- `NOTIFICATIONS.md` - other channels (email, Discord/Slack webhook)

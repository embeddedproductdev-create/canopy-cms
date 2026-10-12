/**
 * Sends one sample notification through every enabled channel (see NOTIFICATIONS.md).
 *   pnpm run notify:test
 * Reads NOTIFY_* from .env (or the shell). Exits non-zero when no channel is configured or one fails.
 */
import { enabledChannels, notifySubmission } from '../src/lib/notify'

const active = enabledChannels()
if (active.length === 0) {
  console.error('No notification channel configured. Set the NOTIFY_* variables listed in NOTIFICATIONS.md.')
  process.exit(1)
}
console.log(`Sending a test notification via: ${active.join(', ')}`)
const results = await notifySubmission({
  id: 0,
  form: 'test',
  name: 'Test Visitor',
  email: 'test@example.com',
  company: 'Canopy test',
  message: 'This is a test notification from the Canopy CMS. If you can read this, the channel works.',
  source: '/notify-test',
})
for (const r of results) console.log(r.ok ? `  ✓ ${r.channel}` : `  ✗ ${r.channel}: ${r.error}`)
process.exit(results.every((r) => r.ok) ? 0 : 1)

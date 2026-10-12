import type { CollectionAfterChangeHook } from 'payload'
import { enabledChannels, notifySubmission, type SubmissionSummary } from '../lib/notify'

/**
 * After a website form submission is created, push a notification to every enabled free channel
 * (Telegram / Resend email / Discord-Slack webhook; see NOTIFICATIONS.md). It runs in the
 * background (Cloudflare `waitUntil` when available) so the visitor never waits and a failing
 * channel never breaks the submission.
 */
export const notifyOnSubmission: CollectionAfterChangeHook = async ({ doc, operation }) => {
  if (operation !== 'create' || doc?.status === 'archived') return doc
  if (enabledChannels().length === 0) return doc

  const job = notifySubmission(doc as SubmissionSummary)
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    getCloudflareContext().ctx.waitUntil(job)
  } catch {
    // Local dev / non-Workers runtime: let it finish on its own (it never rejects).
    void job
  }
  return doc
}

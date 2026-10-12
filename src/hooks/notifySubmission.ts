import type { CollectionAfterChangeHook } from 'payload'
import { enabledChannels, notifySubmission, type SubmissionSummary } from '../lib/notify'

export const notifyOnSubmission: CollectionAfterChangeHook = async ({ doc, operation }) => {
  if (operation !== 'create' || doc?.status === 'archived') return doc
  if (enabledChannels().length === 0) return doc

  const job = notifySubmission(doc as SubmissionSummary)
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    getCloudflareContext().ctx.waitUntil(job)
  } catch {
    void job
  }
  return doc
}

export interface SubmissionSummary {
  id: number | string
  form: string
  email: string
  name?: string
  company?: string
  phone?: string
  scope?: string
  message?: string
  checklist?: string
  source?: string
  data?: Record<string, unknown>
  createdAt?: string
}

type Channel = { name: string; enabled: () => boolean; send: (s: SubmissionSummary, text: string) => Promise<void> }

const env = (key: string): string => (process.env[key] ?? '').trim()
const signal = () => AbortSignal.timeout(5000)

const adminUrl = (id: number | string): string => {
  const base = (env('NOTIFY_ADMIN_URL') || env('NEXT_PUBLIC_SERVER_URL') || '').replace(/\/$/, '')
  return base ? `${base}/admin/collections/form-submission/${id}` : ''
}

const detail = (s: SubmissionSummary, key: string): string => {
  const value = s.data?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

export function formatText(s: SubmissionSummary): string {
  const lines = [
    `New website submission — ${s.form}`,
    s.name ? `Name: ${s.name}` : '',
    `Email: ${s.email}`,
    s.phone ? `Phone: ${s.phone}` : '',
    s.company ? `Company: ${s.company}` : '',
    detail(s, 'role') ? `Role: ${detail(s, 'role')}` : '',
    detail(s, 'slot') ? `Slot: ${detail(s, 'slot')}` : '',
    s.scope ? `Scope: ${s.scope}` : '',
    s.checklist ? `Checklist: ${s.checklist}` : '',
    s.message ? `Message: ${s.message}` : '',
    s.source ? `Page: ${s.source}` : '',
    adminUrl(s.id) ? `Open: ${adminUrl(s.id)}` : '',
  ]
  return lines.filter(Boolean).join('\n').slice(0, 3500)
}

const escapeHtml = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const channels: Channel[] = [
  {
    name: 'telegram',
    enabled: () => !!env('NOTIFY_TELEGRAM_BOT_TOKEN') && !!env('NOTIFY_TELEGRAM_CHAT_ID'),
    send: async (_s, text) => {
      const res = await fetch(`https://api.telegram.org/bot${env('NOTIFY_TELEGRAM_BOT_TOKEN')}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: env('NOTIFY_TELEGRAM_CHAT_ID'), text, disable_web_page_preview: true }),
        signal: signal(),
      })
      if (!res.ok) throw new Error(`telegram ${res.status} ${await res.text()}`)
    },
  },
  {
    name: 'resend',
    enabled: () => !!env('NOTIFY_RESEND_API_KEY') && !!env('NOTIFY_EMAIL_FROM') && !!env('NOTIFY_EMAIL_TO'),
    send: async (s, text) => {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env('NOTIFY_RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: env('NOTIFY_EMAIL_FROM'),
          to: env('NOTIFY_EMAIL_TO').split(',').map((a) => a.trim()).filter(Boolean),
          reply_to: s.email,
          subject: `New ${s.form} submission — ${s.name || s.email}`,
          text,
          html: `<pre style="font:14px/1.5 system-ui,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
        }),
        signal: signal(),
      })
      if (!res.ok) throw new Error(`resend ${res.status} ${await res.text()}`)
    },
  },
  {
    name: 'webhook',
    enabled: () => !!env('NOTIFY_WEBHOOK_URL'),
    send: async (_s, text) => {
      const body = env('NOTIFY_WEBHOOK_TYPE').toLowerCase() === 'discord' ? { content: text.slice(0, 1900) } : { text }
      const res = await fetch(env('NOTIFY_WEBHOOK_URL'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: signal(),
      })
      if (!res.ok) throw new Error(`webhook ${res.status} ${await res.text()}`)
    },
  },
]

export const enabledChannels = (): string[] => channels.filter((c) => c.enabled()).map((c) => c.name)

export async function notifySubmission(summary: SubmissionSummary): Promise<{ channel: string; ok: boolean; error?: string }[]> {
  const text = formatText(summary)
  const active = channels.filter((c) => c.enabled())
  const results = await Promise.allSettled(active.map((c) => c.send(summary, text)))
  return results.map((r, i) => {
    const channel = active[i].name
    if (r.status === 'rejected') {
      const error = r.reason instanceof Error ? r.reason.message : String(r.reason)
      console.error(`[notify:${channel}] ${error}`)
      return { channel, ok: false, error }
    }
    return { channel, ok: true }
  })
}

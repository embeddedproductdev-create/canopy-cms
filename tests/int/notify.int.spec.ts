import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatText, notifySubmission } from '@/lib/notify'

const consultation = {
  id: 7,
  form: 'consultation',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  company: 'Analytical Engines',
  phone: '+91 98765 43210',
  message: 'We need a BMS review.',
  source: '/work/smart-bms',
  data: { role: 'Founder', slot: 'Tue 10:00' },
}

describe('submission notifications', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('puts the mobile number, role and slot in the alert', () => {
    const text = formatText(consultation)
    expect(text).toContain('Phone: +91 98765 43210')
    expect(text).toContain('Role: Founder')
    expect(text).toContain('Slot: Tue 10:00')
  })

  it('leaves out lines for values that were not submitted', () => {
    const text = formatText({ id: 1, form: 'subscribe', email: 'a@b.co' })
    expect(text).not.toContain('Phone:')
    expect(text).not.toContain('Role:')
    expect(text).not.toContain('Slot:')
  })

  it('sends the alert to the Telegram chat when the bot is configured', async () => {
    vi.stubEnv('NOTIFY_TELEGRAM_BOT_TOKEN', 'token123')
    vi.stubEnv('NOTIFY_TELEGRAM_CHAT_ID', '-100555')
    vi.stubEnv('NOTIFY_RESEND_API_KEY', '')
    vi.stubEnv('NOTIFY_WEBHOOK_URL', '')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' })
    vi.stubGlobal('fetch', fetchMock)

    const results = await notifySubmission(consultation)

    expect(results).toEqual([{ channel: 'telegram', ok: true }])
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.telegram.org/bottoken123/sendMessage')
    const body = JSON.parse(init.body)
    expect(body.chat_id).toBe('-100555')
    expect(body.text).toContain('Phone: +91 98765 43210')
  })
})

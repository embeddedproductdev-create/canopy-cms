import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { prepareDatabase } from '@/utilities/prepareDatabase'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
const created: (number | string)[] = []
let counter = 0
const unique = () => `phone-test-${Date.now()}-${counter++}@example.com`

const consultation = (overrides: Record<string, unknown> = {}) => ({
  form: 'consultation',
  email: unique(),
  name: 'Ada Lovelace',
  company: 'Analytical Engines',
  message: 'We need a BMS review.',
  phone: '+91 98765 43210',
  ...overrides,
})

const submit = async (data: Record<string, unknown>) => {
  const doc = await payload.create({ collection: 'form-submission', data: data as never })
  created.push(doc.id)
  return doc as unknown as Record<string, unknown>
}

describe('form submissions: mobile number', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await prepareDatabase(payload.db.drizzle)
  })

  afterAll(async () => {
    for (const id of created) await payload.delete({ collection: 'form-submission', id })
  })

  it('stores the mobile number of a consultation request', async () => {
    const doc = await submit(consultation())
    expect(doc['phone']).toBe('+91 98765 43210')
  })

  it('rejects a consultation request without a mobile number', async () => {
    await expect(submit(consultation({ phone: '' }))).rejects.toThrow(/phone/i)
  })

  it.each(['12345', 'call me maybe', '1234567890123456'])('rejects the invalid mobile number %s', async (phone) => {
    await expect(submit(consultation({ phone }))).rejects.toThrow(/phone/i)
  })

  it('does not ask other forms for a mobile number', async () => {
    const doc = await submit({ form: 'subscribe', email: unique() })
    expect(doc['form']).toBe('subscribe')
  })
})

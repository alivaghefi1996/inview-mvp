import test from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { INQUIRY_CONSENT_VERSION } from '../app/lib/consent'
import { inquiries } from '../database/schema'
import type { AppDatabase } from '../database/context'
import { createApiApp } from './api-app'
import { deliverPendingInquiries, listInquiries, normalizeContact, paperclipConfig, startInquiryRetry, submitInquiry } from './inquiries'
import { rateLimitConfig } from './rate-limit'
import { createTestDb } from './test-db'

const TOKEN = 'test-paperclip-token'
const ENV = {
  PAPERCLIP_API_URL: 'https://paperclip.invalid/',
  PAPERCLIP_COMPANY_ID: 'company-1',
  PAPERCLIP_PROJECT_ID: 'project-1',
  PAPERCLIP_INQUIRY_ASSIGNEE_USER_ID: 'user-ali',
  PAPERCLIP_API_TOKEN: TOKEN,
} as unknown as NodeJS.ProcessEnv

const VALID = {
  galleryName: 'Gallery One',
  contactPerson: 'Sara',
  contact: '۰۹۱۲ ۱۲۳ ۴۵۶۷',
  message: 'We open a show in spring.',
  lang: 'fa',
  consent: true,
  consentTextVersion: INQUIRY_CONSENT_VERSION,
}

const START = new Date('2026-11-02T10:00:00.000Z')

async function withDb(fn: (db: AppDatabase) => Promise<void>) {
  const fixture = await createTestDb()
  try {
    await fn(fixture.db as unknown as AppDatabase)
  } finally {
    await fixture.close()
  }
}

function fakePaperclip() {
  const calls: { url: string; init: RequestInit; body: Record<string, string> }[] = []
  let up = true
  const fetchImpl = (async (url: string, init: RequestInit) => {
    if (!up) throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } })
    const body = JSON.parse(String(init.body)) as Record<string, string>
    const number = calls.push({ url: String(url), init, body })
    await new Promise((resolve) => setTimeout(resolve, 5))
    return new Response(JSON.stringify({ id: `issue-${number}`, identifier: `HAD-${number}` }), { status: 201 })
  }) as unknown as typeof fetch
  return { calls, fetchImpl, setUp: (value: boolean) => { up = value } }
}

function saved(db: AppDatabase) {
  return db.select().from(inquiries).orderBy(inquiries.galleryName)
}

test('Paperclip stopped keeps the inquiry, and the task appears after Paperclip returns', async () => {
  await withDb(async (db) => {
    const paperclip = fakePaperclip()
    paperclip.setUp(false)
    assert.equal((await submitInquiry(db, VALID, 'ip-a', START)).status, 201)
    const failed = await deliverPendingInquiries(db, { env: ENV, fetchImpl: paperclip.fetchImpl, clock: () => START })
    assert.deepEqual(failed, { delivered: 0, failed: 1 })
    const [kept] = await saved(db)
    assert.equal(kept.contact, '09121234567')
    assert.equal(kept.paperclipIssueId, null)
    assert.equal(kept.attempts, 1)
    assert.equal(kept.lastError, 'TypeError: ECONNREFUSED')
    assert.equal(kept.nextAttemptAt.getTime(), START.getTime() + 60_000)

    paperclip.setUp(true)
    const early = await deliverPendingInquiries(db, { env: ENV, fetchImpl: paperclip.fetchImpl, clock: () => new Date(START.getTime() + 59_000) })
    assert.deepEqual(early, { delivered: 0, failed: 0 })

    const later = new Date(START.getTime() + 60_000)
    assert.deepEqual(await deliverPendingInquiries(db, { env: ENV, fetchImpl: paperclip.fetchImpl, clock: () => later }), { delivered: 1, failed: 0 })
    const [done] = await saved(db)
    assert.equal(done.paperclipIssueId, 'issue-1')
    assert.equal(done.paperclipIssueIdentifier, 'HAD-1')
    assert.equal(done.lastError, null)
    assert.equal(done.attempts, 2)

    assert.deepEqual(await deliverPendingInquiries(db, { env: ENV, fetchImpl: paperclip.fetchImpl, clock: () => new Date(later.getTime() + 86_400_000) }), { delivered: 0, failed: 0 })
    assert.equal(paperclip.calls.length, 1)
  })
})

test('the Paperclip request has the documented shape with a User-Agent header', async () => {
  await withDb(async (db) => {
    const paperclip = fakePaperclip()
    await submitInquiry(db, VALID, 'ip-a', START)
    await deliverPendingInquiries(db, { env: ENV, fetchImpl: paperclip.fetchImpl, clock: () => START })
    const [call] = paperclip.calls
    assert.equal(call.url, 'https://paperclip.invalid/api/companies/company-1/issues')
    assert.equal(call.init.method, 'POST')
    const headers = call.init.headers as Record<string, string>
    assert.equal(headers.Authorization, `Bearer ${TOKEN}`)
    assert.ok(headers['User-Agent'])
    assert.equal(call.body.projectId, 'project-1')
    assert.equal(call.body.status, 'todo')
    assert.equal(call.body.priority, 'high')
    assert.equal(call.body.assigneeUserId, 'user-ali')
    assert.match(call.body.title, /Gallery One/)
    assert.match(call.body.description, /We open a show in spring\./)
    assert.match(call.body.description, /09121234567/)
  })
})

test('two concurrent retries create one issue for each inquiry', async () => {
  await withDb(async (db) => {
    const paperclip = fakePaperclip()
    for (const galleryName of ['A', 'B', 'C']) await submitInquiry(db, { ...VALID, galleryName }, 'ip-a', START)
    const options = { env: ENV, fetchImpl: paperclip.fetchImpl, clock: () => START }
    const [left, right] = await Promise.all([deliverPendingInquiries(db, options), deliverPendingInquiries(db, options)])
    assert.equal(left.delivered + right.delivered, 3)
    assert.equal(paperclip.calls.length, 3)
    assert.deepEqual(paperclip.calls.map((call) => call.body.title).sort(), ['Gallery inquiry: A', 'Gallery inquiry: B', 'Gallery inquiry: C'])
    const rows = await saved(db)
    assert.equal(new Set(rows.map((row) => row.paperclipIssueId)).size, 3)
    assert.ok(rows.every((row) => row.attempts === 1))
  })
})

test('a pass that dies after the claim leaves the row for a later retry', async () => {
  await withDb(async (db) => {
    await submitInquiry(db, VALID, 'ip-a', START)
    const hanging = (() => new Promise(() => undefined)) as unknown as typeof fetch
    void deliverPendingInquiries(db, { env: ENV, fetchImpl: hanging, clock: () => START })
    await new Promise((resolve) => setTimeout(resolve, 50))
    const paperclip = fakePaperclip()
    assert.deepEqual(await deliverPendingInquiries(db, { env: ENV, fetchImpl: paperclip.fetchImpl, clock: () => START }), { delivered: 0, failed: 0 })
    const later = new Date(START.getTime() + 120_000)
    assert.deepEqual(await deliverPendingInquiries(db, { env: ENV, fetchImpl: paperclip.fetchImpl, clock: () => later }), { delivered: 1, failed: 0 })
  })
})

test('an unset token keeps the inquiry pending with no request and no attempt', async () => {
  await withDb(async (db) => {
    const paperclip = fakePaperclip()
    await submitInquiry(db, VALID, 'ip-a', START)
    for (const name of Object.keys(ENV)) {
      const env = { ...ENV, [name]: '' }
      assert.equal(paperclipConfig(env), null)
      assert.deepEqual(await deliverPendingInquiries(db, { env, fetchImpl: paperclip.fetchImpl, clock: () => START }), { delivered: 0, failed: 0 })
    }
    assert.equal(paperclip.calls.length, 0)
    const [row] = await saved(db)
    assert.equal(row.paperclipIssueId, null)
    assert.equal(row.attempts, 0)
    assert.equal(row.lastError, null)
  })
})

test('a Paperclip refusal stores the status only and backs off to a cap', async () => {
  await withDb(async (db) => {
    const refusing = (async () => new Response(`denied ${TOKEN}`, { status: 403 })) as unknown as typeof fetch
    await submitInquiry(db, VALID, 'ip-a', START)
    let now = START
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const moment = now
      assert.deepEqual(await deliverPendingInquiries(db, { env: ENV, fetchImpl: refusing, clock: () => moment }), { delivered: 0, failed: 1 })
      const [row] = await saved(db)
      assert.equal(row.lastError, 'HTTP 403')
      assert.ok(row.nextAttemptAt.getTime() - moment.getTime() <= 3_600_000)
      now = row.nextAttemptAt
    }
    const [row] = await saved(db)
    assert.equal(row.attempts, 12)
    assert.equal(row.nextAttemptAt.getTime() - START.getTime() > 3_600_000, true)
  })
})

test('the periodic retry runs and stops', async () => {
  await withDb(async (db) => {
    const paperclip = fakePaperclip()
    await submitInquiry(db, VALID, 'ip-a', new Date(Date.now() - 1000))
    const stop = startInquiryRetry(db, { env: ENV, fetchImpl: paperclip.fetchImpl }, 5)
    try {
      for (let wait = 0; wait < 100 && paperclip.calls.length === 0; wait += 1) await new Promise((resolve) => setTimeout(resolve, 10))
    } finally {
      stop()
    }
    assert.equal(paperclip.calls.length, 1)
  })
})

test('validation refuses incomplete inquiries and stores nothing', async () => {
  await withDb(async (db) => {
    for (const change of [{ galleryName: ' ' }, { contactPerson: 7 }, { message: '' }, { message: 'x'.repeat(4001) }, { consent: false }, { contact: 'nope' }, { contact: '12' }, { consentTextVersion: 'old' }]) {
      const result = await submitInquiry(db, { ...VALID, ...change }, 'ip-a', START)
      assert.equal(result.status, 400)
      const body = result.body as { error: string; errorFa: string }
      assert.ok(body.error && body.errorFa)
    }
    assert.equal((await saved(db)).length, 0)
    assert.equal(normalizeContact('Ali@Example.com'), 'Ali@Example.com')
    assert.equal(normalizeContact('+98 (912) 123-4567'), '09121234567')
    assert.equal(normalizeContact('+358 40 1234567'), '+358401234567')
  })
})

test('the limiter answers 429 after the limit and invalid input does not spend it', async () => {
  await withDb(async (db) => {
    const config = { ...rateLimitConfig(), inquiryIpMax: 2 }
    await submitInquiry(db, { ...VALID, contact: 'bad' }, 'ip-a', START, config)
    assert.equal((await submitInquiry(db, VALID, 'ip-a', START, config)).status, 201)
    assert.equal((await submitInquiry(db, VALID, 'ip-a', START, config)).status, 201)
    const blocked = await submitInquiry(db, VALID, 'ip-a', START, config)
    assert.equal(blocked.status, 429)
    assert.ok(blocked.retryAfterSeconds)
    assert.equal((await submitInquiry(db, VALID, 'ip-b', START, config)).status, 201)
    assert.equal((await saved(db)).length, 3)
  })
})

test('the public route saves with no Paperclip configuration and refuses a foreign origin', async () => {
  const fixture = await createTestDb()
  const saved_url = process.env.PUBLIC_APP_URL
  process.env.PUBLIC_APP_URL = 'http://inview.test'
  try {
    const app = createApiApp(fixture.db, fixture.storage)
    const ok = await request(app).post('/api/v1/inquiries').set('origin', 'http://inview.test').set('x-test-client', 'route').send(VALID)
    assert.equal(ok.status, 201)
    assert.deepEqual(ok.body, { ok: true })
    assert.equal(ok.headers['cache-control'], 'no-store')
    const foreign = await request(app).post('/api/v1/inquiries').set('origin', 'http://other.test').send(VALID)
    assert.equal(foreign.status, 403)
    assert.equal((await saved(fixture.db as unknown as AppDatabase)).length, 1)
  } finally {
    if (saved_url === undefined) delete process.env.PUBLIC_APP_URL
    else process.env.PUBLIC_APP_URL = saved_url
    await fixture.close()
  }
})

test('operators see task state with no token, support sees a masked contact, others are refused', async () => {
  await withDb(async (db) => {
    const paperclip = fakePaperclip()
    await submitInquiry(db, { ...VALID, galleryName: 'Delivered' }, 'ip-a', START)
    await deliverPendingInquiries(db, { env: ENV, fetchImpl: paperclip.fetchImpl, clock: () => START })
    await submitInquiry(db, { ...VALID, galleryName: 'Waiting' }, 'ip-a', new Date(START.getTime() + 1000))
    const admin = await listInquiries(db, { kind: 'operator', userId: 'u', platformRole: 'admin' }, ENV)
    const byName = Object.fromEntries(admin.map((row) => [row.galleryName, row]))
    assert.equal(byName.Delivered.state, 'created')
    assert.equal(byName.Delivered.taskUrl, 'https://paperclip.invalid/HAD/issues/HAD-1')
    assert.equal(byName.Waiting.state, 'pending')
    assert.equal(byName.Waiting.taskUrl, null)
    assert.equal(byName.Waiting.contact, '09121234567')
    assert.ok(!JSON.stringify(admin).includes(TOKEN))
    const support = await listInquiries(db, { kind: 'operator', userId: 'u', platformRole: 'support' }, ENV)
    assert.ok(support.every((row) => row.contact.includes('•')))
    await assert.rejects(listInquiries(db, null, ENV))
    await assert.rejects(listInquiries(db, { kind: 'staff', userId: 'u', memberships: [] }, ENV))
  })
})

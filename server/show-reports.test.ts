import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
delete process.env.O_GALLERY_ACCESS_CODE
process.env.PUBLIC_APP_URL = 'http://localhost'

import { eq } from 'drizzle-orm'
import request from 'supertest'
import { CONSENT_TEXT_VERSION } from '../app/lib/consent.ts'
import { galleries, leads, memberships, qrCodes, shows, showWorks, visits, works } from '../database/schema.ts'
import type { AppDatabase } from '../database/context.ts'
import { createApiApp } from './api-app.ts'
import { createUser, createUserSession } from './accounts.ts'
import { ensureOGalleryTenant } from './gallery-bootstrap.ts'
import { recordVisit, tenantById } from './gallery-record.ts'
import { galleryQrCodes } from './ops-data.ts'
import { staffQr, staffQrCodes } from './qr.ts'
import { createTestDb } from './test-db.ts'

const VISITOR = 'visitor-show-1'

async function withTwoShows(fn: (args: {
  app: ReturnType<typeof createApiApp>
  db: AppDatabase
  cookie: string
  galleryId: string
  showA: string
  showB: string
}) => Promise<void>) {
  const testDb = await createTestDb()
  try {
    const { gallery, show } = await ensureOGalleryTenant(testDb.db)
    const db = testDb.db as unknown as AppDatabase
    const user = await createUser(db, { email: 'shows-owner@example.com', password: 'shows-password' })
    await db.insert(memberships).values({ galleryId: gallery.id, userId: user.id, role: 'owner' })
    const session = await createUserSession(db, user.id, false)
    await db.update(shows).set({ status: 'archived' }).where(eq(shows.id, show.id))
    const [next] = await db.insert(shows).values({ galleryId: gallery.id, titleEn: 'Show B', status: 'published' }).returning()
    await db.insert(works).values([
      { id: 'show-a-work', galleryId: gallery.id, title: 'Work A' },
      { id: 'show-b-work', galleryId: gallery.id, title: 'Work B' },
    ])
    await db.insert(showWorks).values([{ showId: show.id, workId: 'show-a-work' }, { showId: next.id, workId: 'show-b-work' }])
    await fn({ app: createApiApp(testDb.db, testDb.storage), db, cookie: session.cookie, galleryId: gallery.id, showA: show.id, showB: next.id })
  } finally {
    await testDb.close()
  }
}

function lead(galleryId: string, showId: string, workId: string, phone: string) {
  return { galleryId, showId, workId, phone, kind: 'ask' as const, consentAt: new Date(), consentTextVersion: CONSENT_TEXT_VERSION }
}

test('HAD-121 a report and its CSV count only the requested show', async () => {
  await withTwoShows(async ({ app, db, cookie, galleryId, showA, showB }) => {
    await db.insert(visits).values([
      { showId: showA, visitorId: VISITOR, kind: 'scan', day: '2026-11-01' },
      { showId: showA, visitorId: 'visitor-show-2', kind: 'scan', day: '2026-11-01' },
      { showId: showA, visitorId: VISITOR, kind: 'view', day: '2026-11-01', workId: 'show-a-work' },
      { showId: showB, visitorId: VISITOR, kind: 'scan', day: '2026-11-02' },
    ])
    await db.insert(leads).values([
      lead(galleryId, showA, 'show-a-work', '09120000011'),
      lead(galleryId, showA, 'show-a-work', '09120000012'),
      lead(galleryId, showB, 'show-b-work', '09120000013'),
    ])

    const current = await request(app).get('/api/v1/pilot/staff?gallery=o-gallery').set('Cookie', cookie)
    assert.equal(current.status, 200)
    assert.deepEqual(current.body.visits, { scans: 1, views: 0 })
    assert.deepEqual(current.body.leads.map((row: { phone: string }) => row.phone), ['+989120000013'])
    assert.deepEqual(current.body.works.map((row: { workId: string; asks: number }) => [row.workId, row.asks]), [['show-b-work', 1]])

    const archived = await request(app).get(`/api/v1/pilot/staff?gallery=o-gallery&show=${showA}`).set('Cookie', cookie)
    assert.equal(archived.status, 200)
    assert.deepEqual(archived.body.visits, { scans: 2, views: 1 })
    assert.deepEqual(archived.body.leads.map((row: { phone: string }) => row.phone).sort(), ['+989120000011', '+989120000012'])

    const csv = await request(app).get(`/api/v1/pilot/staff/leads.csv?gallery=o-gallery&show=${showA}`).set('Cookie', cookie)
    assert.equal(csv.status, 200)
    assert.ok(csv.text.includes('+989120000011'))
    assert.ok(!csv.text.includes('09120000013'))
  })
})

test('HAD-121 an archived report lists every day of the show, and a current report the last 30 days', async () => {
  await withTwoShows(async ({ app, db, cookie, showA, showB }) => {
    const old = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    await db.insert(visits).values([
      { showId: showA, visitorId: VISITOR, kind: 'scan', day: '2026-01-01', createdAt: old },
      { showId: showB, visitorId: VISITOR, kind: 'scan', day: '2026-01-01', createdAt: old },
    ])
    const archived = await request(app).get(`/api/v1/pilot/staff?gallery=o-gallery&show=${showA}`).set('Cookie', cookie)
    assert.equal(archived.body.days.length, 1)
    const current = await request(app).get('/api/v1/pilot/staff?gallery=o-gallery').set('Cookie', cookie)
    assert.equal(current.body.days.length, 0)
  })
})

test('HAD-121 a report refuses a show of another gallery and a malformed show id', async () => {
  await withTwoShows(async ({ app, db, cookie }) => {
    const [other] = await db.insert(galleries).values({ slug: 'other-gallery', nameEn: 'Other', nameFa: 'دیگر' }).returning()
    const [foreign] = await db.insert(shows).values({ galleryId: other.id, status: 'published' }).returning()
    for (const show of [foreign.id, 'not-a-uuid']) {
      const report = await request(app).get(`/api/v1/pilot/staff?gallery=o-gallery&show=${show}`).set('Cookie', cookie)
      assert.equal(report.status, 404)
      const csv = await request(app).get(`/api/v1/pilot/staff/leads.csv?gallery=o-gallery&show=${show}`).set('Cookie', cookie)
      assert.equal(csv.status, 404)
    }
  })
})

test('HAD-121 a code printed for the old show stays listed and counts a scan on the current show', async () => {
  await withTwoShows(async ({ db, galleryId, showA, showB }) => {
    const [printed] = await db.select().from(qrCodes).where(eq(qrCodes.showId, showA))
    const tenant = (await tenantById(db, galleryId))!
    assert.equal(tenant.show.id, showB)

    assert.deepEqual((await staffQrCodes(db, tenant)).map((row) => row.code), [printed.code])
    assert.equal((await staffQr(db, tenant, printed.code))?.code, printed.code)

    const scan = await recordVisit(db, tenant, 'scan', VISITOR, null, printed.code)
    assert.equal(scan.status, 200)
    const [row] = await db.select().from(visits).where(eq(visits.visitorId, VISITOR))
    assert.equal(row.showId, showB)
    assert.equal(row.qrCodeId, printed.id)

    assert.equal((await staffQrCodes(db, tenant))[0].scans, 1)
    const [listed] = await galleryQrCodes(db, { kind: 'operator', userId: 'operator', platformRole: 'admin' }, galleryId)
    assert.equal(listed.scans, 1)
  })
})

test('HAD-121 a code of another gallery does not get the scan', async () => {
  await withTwoShows(async ({ db, galleryId }) => {
    const [other] = await db.insert(galleries).values({ slug: 'other-gallery', nameEn: 'Other', nameFa: 'دیگر' }).returning()
    const [foreign] = await db.insert(shows).values({ galleryId: other.id, status: 'published' }).returning()
    await db.insert(qrCodes).values({ showId: foreign.id, code: 'other-gallery-main' })
    const tenant = (await tenantById(db, galleryId))!
    await recordVisit(db, tenant, 'scan', VISITOR, null, 'other-gallery-main')
    const [row] = await db.select().from(visits).where(eq(visits.visitorId, VISITOR))
    assert.equal(row.qrCodeId, null)
    assert.equal(await staffQr(db, tenant, 'other-gallery-main'), undefined)
  })
})

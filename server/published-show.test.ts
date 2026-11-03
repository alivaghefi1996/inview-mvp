import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.PUBLIC_RECORD_TTL_MS = '5000'
delete process.env.O_GALLERY_ACCESS_CODE

import { eq } from 'drizzle-orm'
import request from 'supertest'
import { leadBody } from '../app/lib/consent.ts'
import { loadGalleryPage, loadWorkPage } from '../app/routes/pilot.server.ts'
import { DatabaseContext, type AppDatabase } from '../database/context.ts'
import { auditLogs, galleries, leads, qrCodes, rateLimits, showWorks, shows, visits, works } from '../database/schema.ts'
import { createUser } from './accounts.ts'
import { createApiApp } from './api-app.ts'
import type { Principal } from './authz.ts'
import { hashSecret } from './crypto.ts'
import { loadPublicPage, loadStaffRecord, PUBLIC_RECORD_TTL_MS, tenantBySlug } from './gallery-record.ts'
import { createGallery, updateGallery } from './ops.ts'
import { handlePilotApi } from './pilot-api.ts'
import { createTestDb } from './test-db.ts'

type TestDb = Awaited<ReturnType<typeof createTestDb>>

const SLUG = 'hidden-show'
const WORK_ID = 'hiddenwork01'
const VISITOR = 'hidden-visitor-1'
const SHOW_TITLE = 'Quiet Surfaces'
const ACCESS_CODE = 'gallery-password'

function pageRequest(path: string) {
  return new Request(`http://inview.test${path}`)
}

async function rejection(task: Promise<unknown>): Promise<Response> {
  try {
    await task
  } catch (thrown) {
    assert.ok(thrown instanceof Response, `expected a Response, got ${String(thrown)}`)
    return thrown
  }
  throw new Error('The loader resolved instead of answering with a status.')
}

async function withLiveGallery(
  fn: (args: {
    db: TestDb['db']
    storage: TestDb['storage']
    app: ReturnType<typeof createApiApp>
    show: typeof shows.$inferSelect
    run: <T>(task: () => Promise<T>) => Promise<T>
  }) => Promise<void>,
) {
  const testDb = await createTestDb()
  try {
    const { db } = testDb
    const [gallery] = await db
      .insert(galleries)
      .values({ slug: SLUG, nameEn: 'Hidden Gallery', nameFa: 'گالری پنهان', status: 'live', accessCodeHash: hashSecret(ACCESS_CODE) })
      .returning()
    const [show] = await db
      .insert(shows)
      .values({ galleryId: gallery.id, titleEn: SHOW_TITLE, titleFa: 'سطوح آرام', status: 'published' })
      .returning()
    await db.insert(works).values({ id: WORK_ID, galleryId: gallery.id, title: 'Harbour light', titleFa: 'نور بندر', artist: 'N. Karimi', status: 'available' })
    await db.insert(showWorks).values({ showId: show.id, workId: WORK_ID, sortOrder: 0 })
    await db.insert(qrCodes).values({ showId: show.id, code: `${SLUG}-main`, label: 'Entrance' })
    await fn({
      db,
      storage: testDb.storage,
      app: createApiApp(db, testDb.storage),
      show,
      run: <T>(task: () => Promise<T>) => DatabaseContext.run(db, task),
    })
  } finally {
    await testDb.close()
  }
}

async function postVisit(app: ReturnType<typeof createApiApp>, kind: 'scan' | 'view') {
  return request(app)
    .post('/api/v1/pilot')
    .send({ op: 'visit', gallery: SLUG, kind, visitorId: VISITOR, workId: WORK_ID, qrCode: `${SLUG}-main` })
}

async function postLead(app: ReturnType<typeof createApiApp>) {
  return request(app)
    .post('/api/v1/pilot')
    .send({ ...leadBody({ phone: '09121234567', kind: 'ask', workId: WORK_ID, visitorId: VISITOR }), gallery: SLUG })
}

for (const status of ['draft', 'archived'] as const) {
  test(`a live gallery whose only show is ${status} serves no catalogue and counts nothing`, async () => {
    await withLiveGallery(async ({ db, app, show, run }) => {
      await db.update(shows).set({ status }).where(eq(shows.id, show.id))
      // A printed QR code of a gallery between two shows lands on a message. A gallery that never opened stays hidden.
      const pageStatus = status === 'archived' ? 302 : 404

      for (const path of [`/g/${SLUG}`, `/g/${SLUG}/works`, `/g/${SLUG}/about`, `/g/${SLUG}/prices`, `/site/${SLUG}`]) {
        const answer = await rejection(run(() => loadGalleryPage(pageRequest(path), SLUG)))
        assert.equal(answer.status, pageStatus, path)
        if (status === 'archived') assert.equal(answer.headers.get('location'), `/g/${SLUG}/closed`, path)
      }
      const work = await rejection(run(() => loadWorkPage(pageRequest(`/g/${SLUG}/works/${WORK_ID}`), SLUG, WORK_ID)))
      assert.equal(work.status, pageStatus)

      assert.equal((await request(app).get(`/api/v1/pilot?gallery=${SLUG}`)).status, 404)
      assert.equal((await postVisit(app, 'scan')).status, 404)
      assert.equal((await postVisit(app, 'view')).status, 404)
      assert.equal((await postLead(app)).status, 404)

      assert.equal((await db.select().from(visits)).length, 0)
      assert.equal((await db.select().from(leads)).length, 0)
      assert.equal((await db.select().from(rateLimits)).length, 0)
    })
  })
}

test('a show that leaves published empties a warm public cache and stops counting at once', async () => {
  await withLiveGallery(async ({ db, app, show }) => {
    const base = Date.now()
    const warm = await loadPublicPage(db, SLUG, base)
    assert.equal(warm?.record.showTitle, SHOW_TITLE)

    await db.update(shows).set({ status: 'draft' }).where(eq(shows.id, show.id))
    assert.equal(await loadPublicPage(db, SLUG, base), warm)
    assert.equal((await postVisit(app, 'view')).status, 404)
    assert.equal((await db.select().from(visits)).length, 0)
    assert.equal(await loadPublicPage(db, SLUG, base + PUBLIC_RECORD_TTL_MS + 1), null)

    await db.update(shows).set({ status: 'published' }).where(eq(shows.id, show.id))
    assert.equal((await loadPublicPage(db, SLUG))?.record.slug, SLUG)
    assert.equal((await postVisit(app, 'view')).status, 200)
  })
})

test('staff read and edit a draft show while its public page stays hidden', async () => {
  await withLiveGallery(async ({ db, storage, show }) => {
    await db.update(shows).set({ status: 'draft' }).where(eq(shows.id, show.id))
    const tenant = (await tenantBySlug(db, SLUG))!
    assert.equal(tenant.show.id, show.id)
    const record = (await loadStaffRecord(db, tenant)).record
    assert.equal(record.showTitle, SHOW_TITLE)
    assert.deepEqual(record.works.map((work) => work.id), [WORK_ID])

    const written = await handlePilotApi(db, storage, 'PUT', {
      gallery: SLUG,
      accessCode: ACCESS_CODE,
      record: { ...record, showTitle: 'Edited in draft' },
    })
    assert.equal(written.status, 200, JSON.stringify(written.body))
    assert.equal((await loadStaffRecord(db, (await tenantBySlug(db, SLUG))!)).record.showTitle, 'Edited in draft')

    const [after] = await db.select({ status: shows.status }).from(shows).where(eq(shows.id, show.id))
    assert.equal(after.status, 'draft')
    assert.equal(await loadPublicPage(db, SLUG), null)
  })
})

async function withOperator(fn: (args: { db: AppDatabase; admin: Principal }) => Promise<void>) {
  const fixture = await createTestDb()
  const db = fixture.db as unknown as AppDatabase
  try {
    const user = await createUser(db, { email: 'admin@example.com', platformRole: 'admin' })
    await fn({ db, admin: { kind: 'operator', userId: user.id, platformRole: 'admin' } })
  } finally {
    await fixture.close()
  }
}

const SETTINGS = { nameFa: 'گالری', nameEn: 'First', notes: '', sharedCodeEnabled: true }

async function showStatus(db: AppDatabase, showId: string) {
  const [row] = await db.select({ status: shows.status }).from(shows).where(eq(shows.id, showId))
  return row.status
}

async function publishedShowIds(db: AppDatabase) {
  const rows = await db.select({ summary: auditLogs.summary }).from(auditLogs).where(eq(auditLogs.action, 'gallery-update'))
  return rows.map((row) => (row.summary as { publishedShowId: string | null }).publishedShowId)
}

test('going live publishes the newest draft show once and the audit entry names it', async () => {
  await withOperator(async ({ db, admin }) => {
    const created = await createGallery(db, admin, { slug: 'first-live', nameFa: 'گالری', nameEn: 'First', showTitle: 'First show', ownerIdentifier: 'owner@example.com' })
    const [first] = await db.select({ id: shows.id }).from(shows).where(eq(shows.galleryId, created.gallery.id))
    const [newer] = await db
      .insert(shows)
      .values({ galleryId: created.gallery.id, titleEn: 'Next season', titleFa: 'فصل بعد', status: 'draft', updatedAt: new Date(Date.now() + 60_000) })
      .returning({ id: shows.id })

    await updateGallery(db, admin, created.gallery.id, { ...SETTINGS, status: 'live' })
    assert.equal(await showStatus(db, newer.id), 'published')
    assert.equal(await showStatus(db, first.id), 'draft')
    assert.deepEqual(await publishedShowIds(db), [newer.id])
    assert.equal((await loadPublicPage(db, 'first-live'))?.record.showTitle, 'Next season')

    const [later] = await db
      .insert(shows)
      .values({ galleryId: created.gallery.id, titleEn: 'Later', titleFa: 'بعدتر', status: 'draft', updatedAt: new Date(Date.now() + 120_000) })
      .returning({ id: shows.id })
    await updateGallery(db, admin, created.gallery.id, { ...SETTINGS, status: 'live' })
    assert.equal(await showStatus(db, later.id), 'draft')
    assert.equal(await showStatus(db, newer.id), 'published')
    assert.deepEqual(await publishedShowIds(db), [newer.id, null])
  })
})

test('going live leaves an archived show archived and the gallery hidden', async () => {
  await withOperator(async ({ db, admin }) => {
    const created = await createGallery(db, admin, { slug: 'past-only', nameFa: 'گالری', nameEn: 'First', showTitle: 'Past show', ownerIdentifier: 'owner@example.com' })
    const [archived] = await db.select({ id: shows.id }).from(shows).where(eq(shows.galleryId, created.gallery.id))
    await db.update(shows).set({ status: 'archived' }).where(eq(shows.id, archived.id))

    await updateGallery(db, admin, created.gallery.id, { ...SETTINGS, status: 'live' })
    assert.equal(await showStatus(db, archived.id), 'archived')
    assert.deepEqual(await publishedShowIds(db), [null])
    assert.equal(await loadPublicPage(db, 'past-only'), null)
  })
})

test('a status that is not live publishes no draft show', async () => {
  await withOperator(async ({ db, admin }) => {
    const created = await createGallery(db, admin, { slug: 'still-draft', nameFa: 'گالری', nameEn: 'First', showTitle: 'First show', ownerIdentifier: 'owner@example.com' })
    const [draft] = await db.select({ id: shows.id }).from(shows).where(eq(shows.galleryId, created.gallery.id))

    for (const status of ['draft', 'paused'] as const) {
      await updateGallery(db, admin, created.gallery.id, { ...SETTINGS, status })
      assert.equal(await showStatus(db, draft.id), 'draft')
    }
    assert.deepEqual(await publishedShowIds(db), [null, null])
  })
})

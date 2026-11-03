import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
delete process.env.O_GALLERY_ACCESS_CODE
process.env.PUBLIC_APP_URL = 'http://localhost'
process.env.PUBLIC_RECORD_TTL_MS = '0'

import { and, eq } from 'drizzle-orm'
import request from 'supertest'
import { auditLogs, galleries, memberships, shows, works } from '../database/schema.ts'
import type { AppDatabase } from '../database/context.ts'
import { AccountInputError, createUser, createUserSession } from './accounts.ts'
import { createApiApp } from './api-app.ts'
import { ensureOGalleryTenant } from './gallery-bootstrap.ts'
import { galleryBetweenShows, loadPublicPage } from './gallery-record.ts'
import { archiveShow, galleryShows, publishShow, startNewShow } from './shows.ts'
import { PermissionError } from './team.ts'
import { createTestDb } from './test-db.ts'

function work(id: string, title: string) {
  return { id, title, artist: '', medium: '', size: '', year: '', price: null, status: 'available', image: '', sample: false }
}

async function withGallery(fn: (args: {
  app: ReturnType<typeof createApiApp>
  db: AppDatabase
  cookie: string
  galleryId: string
  showA: string
  principal: { kind: 'shared-code'; galleryId: string }
  save: (list: unknown[], patch?: Record<string, unknown>, show?: string) => ReturnType<typeof request.agent.prototype.put>
}) => Promise<void>) {
  const testDb = await createTestDb()
  try {
    const { gallery, show } = await ensureOGalleryTenant(testDb.db)
    const db = testDb.db as unknown as AppDatabase
    const user = await createUser(db, { email: 'lifecycle-owner@example.com', password: 'lifecycle-password' })
    await db.insert(memberships).values({ galleryId: gallery.id, userId: user.id, role: 'owner' })
    const session = await createUserSession(db, user.id, false)
    const app = createApiApp(testDb.db, testDb.storage)
    const save = (list: unknown[], patch: Record<string, unknown> = {}, target?: string) => request(app)
      .put('/api/v1/pilot')
      .set('Host', 'localhost').set('Origin', 'http://localhost').set('Cookie', session.cookie)
      .send({ gallery: 'o-gallery', show: target, record: { slug: 'o-gallery', name: 'O', nameFa: 'او', showTitle: 'Show', showTitleFa: '', dates: '', datesFa: '', hours: '', hoursFa: '', address: '', addressFa: '', text: '', textFa: '', pdfUrl: null, logo: null, works: list, ...patch } })
    await fn({ app, db, cookie: session.cookie, galleryId: gallery.id, showA: show.id, principal: { kind: 'shared-code', galleryId: gallery.id }, save: save as never })
  } finally {
    await testDb.close()
  }
}

test('HAD-121 a new show starts as a draft, keeps the place details and leaves visitors on the current show', async () => {
  await withGallery(async ({ db, galleryId, showA, principal, save }) => {
    assert.equal((await save([work('work-show-a', 'Work A')], { showTitle: 'Show A', address: 'Tir street', hours: '10 to 18' })).status, 200)
    const started = await startNewShow(db, principal, galleryId)
    assert.notEqual(started.id, showA)
    const [draft] = await db.select().from(shows).where(eq(shows.id, started.id))
    assert.equal(draft.status, 'draft')
    assert.equal(draft.titleEn, '')
    assert.equal(draft.addressEn, 'Tir street')
    assert.equal(draft.hoursEn, '10 to 18')
    assert.equal((await startNewShow(db, principal, galleryId)).id, started.id)
    assert.equal((await loadPublicPage(db, 'o-gallery'))?.record.showTitle, 'Show A')
  })
})

test('HAD-121 saving the draft does not touch the works of the current show', async () => {
  await withGallery(async ({ db, galleryId, principal, save }) => {
    await save([work('work-show-a', 'Work A')], { showTitle: 'Show A' })
    const { id: showB } = await startNewShow(db, principal, galleryId)

    const saved = await save([work('work-show-b', 'Work B')], { showTitle: 'Show B' }, showB)
    assert.equal(saved.status, 200)
    assert.equal(saved.body.record.showTitle, 'Show B')
    assert.deepEqual(saved.body.record.works.map((row: { id: string }) => row.id), ['work-show-b'])

    const page = await loadPublicPage(db, 'o-gallery')
    assert.equal(page?.record.showTitle, 'Show A')
    assert.deepEqual(page?.record.works.map((row) => row.id), ['work-show-a'])
    const [kept] = await db.select().from(works).where(eq(works.id, 'work-show-a'))
    assert.equal(kept.removedAt, null)

    assert.equal((await save([], { showTitle: 'Show B' }, showB)).status, 200)
    const [dropped] = await db.select().from(works).where(eq(works.id, 'work-show-b'))
    assert.ok(dropped.removedAt)
  })
})

test('HAD-121 publishing the draft moves visitors and archives the old show in one step', async () => {
  await withGallery(async ({ db, galleryId, showA, principal, save }) => {
    await save([work('work-show-a', 'Work A')], { showTitle: 'Show A' })
    const { id: showB } = await startNewShow(db, principal, galleryId)
    await assert.rejects(publishShow(db, principal, galleryId, showB), AccountInputError)
    await save([work('work-show-b', 'Work B')], { showTitle: 'Show B' }, showB)

    assert.deepEqual(await publishShow(db, principal, galleryId, showB), { archivedShowId: showA })

    const page = await loadPublicPage(db, 'o-gallery')
    assert.equal(page?.record.showTitle, 'Show B')
    assert.deepEqual((await galleryShows(db, galleryId)).map((row) => [row.id, row.status]), [[showB, 'published'], [showA, 'archived']])
    await assert.rejects(publishShow(db, principal, galleryId, showB), AccountInputError)
    const [audit] = await db.select().from(auditLogs).where(and(eq(auditLogs.galleryId, galleryId), eq(auditLogs.action, 'show-publish')))
    assert.equal(audit.targetId, showB)
    assert.equal(audit.summary.archivedShowId, showA)
  })
})

test('HAD-121 an archived show cannot change and the gallery has no public show until the next one', async () => {
  await withGallery(async ({ db, galleryId, showA, principal, save }) => {
    await save([work('work-show-a', 'Work A')], { showTitle: 'Show A' })
    await archiveShow(db, principal, galleryId, showA)
    await assert.rejects(archiveShow(db, principal, galleryId, showA), AccountInputError)

    assert.equal(await loadPublicPage(db, 'o-gallery'), null)
    const refused = await save([], { showTitle: 'Changed' })
    assert.equal(refused.status, 400)
    const refusedByName = await save([], { showTitle: 'Changed' }, showA)
    assert.equal(refusedByName.status, 400)
    const [row] = await db.select().from(shows).where(eq(shows.id, showA))
    assert.equal(row.titleEn, 'Show A')

    const { id: showB } = await startNewShow(db, principal, galleryId)
    assert.equal((await save([work('work-show-b', 'Work B')], { showTitle: 'Show B' })).status, 200)
    assert.deepEqual(await publishShow(db, principal, galleryId, showB), { archivedShowId: null })
    assert.equal((await loadPublicPage(db, 'o-gallery'))?.record.showTitle, 'Show B')
  })
})

test('HAD-121 only an editor of the gallery can change its shows', async () => {
  await withGallery(async ({ db, galleryId, showA, principal }) => {
    const viewer = { kind: 'user', userId: 'viewer', memberships: [{ galleryId, role: 'viewer' }] } as never
    await assert.rejects(startNewShow(db, viewer, galleryId), PermissionError)
    await assert.rejects(publishShow(db, viewer, galleryId, showA), PermissionError)
    await assert.rejects(archiveShow(db, viewer, galleryId, showA), PermissionError)

    const [other] = await db.insert(galleries).values({ slug: 'other-gallery', nameEn: 'Other', nameFa: 'دیگر' }).returning()
    const [foreign] = await db.insert(shows).values({ galleryId: other.id, titleEn: 'Foreign', status: 'draft' }).returning()
    await assert.rejects(publishShow(db, principal, galleryId, foreign.id), AccountInputError)
    await assert.rejects(archiveShow(db, principal, galleryId, foreign.id), AccountInputError)
    await assert.rejects(startNewShow(db, principal, other.id), PermissionError)
  })
})

test('HAD-121 a live gallery between shows answers with its name, and other galleries do not', async () => {
  await withGallery(async ({ db, galleryId, showA, principal }) => {
    assert.equal(await galleryBetweenShows(db, 'o-gallery'), null)
    await db.update(shows).set({ titleEn: 'Show A' }).where(eq(shows.id, showA))
    await archiveShow(db, principal, galleryId, showA)
    const [gallery] = await db.select().from(galleries).where(eq(galleries.id, galleryId))
    assert.deepEqual(await galleryBetweenShows(db, 'o-gallery'), { nameEn: gallery.nameEn, nameFa: gallery.nameFa })

    await db.update(galleries).set({ status: 'paused' }).where(eq(galleries.id, galleryId))
    assert.equal(await galleryBetweenShows(db, 'o-gallery'), null)
    assert.equal(await galleryBetweenShows(db, 'missing-gallery'), null)
  })
})

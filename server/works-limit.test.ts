import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
delete process.env.O_GALLERY_ACCESS_CODE

import sharp from 'sharp'
import request from 'supertest'
import { memberships } from '../database/schema.ts'
import { createApiApp, JSON_LIMIT } from './api-app.ts'
import { ensureOGalleryTenant } from './gallery-bootstrap.ts'
import { MAX_WORKS } from './gallery-record.ts'
import { createUser, createUserSession } from './accounts.ts'
import { publishBody, type PilotRecord, type PilotWork } from '../app/lib/pilot.ts'
import type { AppDatabase } from '../database/context.ts'
import { createTestDb } from './test-db.ts'

process.env.PUBLIC_APP_URL = 'http://localhost'

type TestDb = Awaited<ReturnType<typeof createTestDb>>

const JSON_LIMIT_BYTES = Number(JSON_LIMIT.replace('kb', '')) * 1024

async function withStaff(fn: (args: { app: ReturnType<typeof createApiApp>; cookie: string }) => Promise<void>) {
  const testDb = await createTestDb()
  const { gallery } = await ensureOGalleryTenant(testDb.db)
  const app = createApiApp(testDb.db, testDb.storage)
  try {
    const db = testDb.db as unknown as AppDatabase
    const user = await createUser(db, { email: 'works-limit@example.com', password: 'works-limit-password' })
    await db.insert(memberships).values({ galleryId: gallery.id, userId: user.id, role: 'owner' })
    const session = await createUserSession(db, user.id, false)
    await fn({ app, cookie: session.cookie })
  } finally {
    await testDb.close()
  }
}

function worksList(count: number, image: string): unknown[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `wall-work-${String(index).padStart(4, '0')}`,
    title: `Work ${index}`,
    artist: 'N. Karimi',
    medium: '',
    size: '',
    year: '',
    price: null,
    status: 'available',
    image,
    sample: false,
  }))
}

async function publish(app: ReturnType<typeof createApiApp>, cookie: string, list: unknown[]) {
  const current = await request(app).get('/api/v1/pilot?gallery=o-gallery')
  return request(app)
    .put('/api/v1/pilot')
    .set('Host', 'localhost').set('Origin', 'http://localhost')
    .set('Cookie', cookie)
    .send({ gallery: 'o-gallery', record: { ...current.body.record, works: list } })
}

test(`HAD-122 a show publishes ${MAX_WORKS} works and refuses one more`, async () => {
  await withStaff(async ({ app, cookie }) => {
    const file = await sharp({ create: { width: 40, height: 30, channels: 3, background: { r: 30, g: 60, b: 90 } } }).png().toBuffer()
    const upload = await request(app)
      .post('/api/v1/uploads')
      .set('Host', 'localhost').set('Origin', 'http://localhost')
      .set('Cookie', cookie)
      .field('gallery', 'o-gallery')
      .attach('file', file, { filename: 'wall.png', contentType: 'image/png' })
    assert.equal(upload.status, 201)

    const full = await publish(app, cookie, worksList(MAX_WORKS, upload.body.url))
    assert.equal(full.status, 200)
    assert.equal(full.body.record.works.length, MAX_WORKS)

    const read = await request(app).get('/api/v1/pilot?gallery=o-gallery')
    assert.equal(read.body.record.works.length, MAX_WORKS)

    const over = await publish(app, cookie, worksList(MAX_WORKS + 1, upload.body.url))
    assert.equal(over.status, 400)
    assert.equal(over.body.error, `You can publish up to ${MAX_WORKS} works.`)
    assert.equal(over.body.errorFa, 'حداکثر ۱۰۰ اثر می‌توانید منتشر کنید.')
  })
})

// Every field at its longest, Persian counted as two bytes, and absolute media URLs
// on the longest slug the ops form allows: the largest body a full show can send.
function widestRecord(slug = 'a'.repeat(40)): PilotRecord {
  const fa = (count: number) => 'ن'.repeat(count)
  const base = `https://inview-media.moshes.io/inview/u/galleries/${slug}/0b1d2e3f-4a5b-6c7d-8e9f-0a1b2c3d4e5f`
  const srcSet = (format: string) => [320, 640, 1280].map((width) => `${base}/w${width}.${format} ${width}w`).join(', ')
  const works: PilotWork[] = Array.from({ length: MAX_WORKS }, (_, index) => ({
    id: `${String(index).padStart(4, '0')}${'a'.repeat(76)}`,
    artist: 'A'.repeat(80),
    artistFa: fa(80),
    title: 'T'.repeat(120),
    titleFa: fa(120),
    medium: 'M'.repeat(80),
    mediumFa: fa(80),
    size: 'S'.repeat(80),
    year: '1'.repeat(20),
    price: 1234567890,
    status: 'available',
    image: `${base}/w1280.webp`,
    imageSet: { webp: srcSet('webp'), jpeg: srcSet('jpeg') },
    sample: false,
  }))
  return {
    slug,
    demo: false,
    name: 'G'.repeat(80),
    nameFa: fa(80),
    logo: `${base}/w640.webp`,
    showTitle: 'X'.repeat(160),
    showTitleFa: fa(160),
    dates: 'd'.repeat(80),
    datesFa: fa(80),
    hours: 'h'.repeat(120),
    hoursFa: fa(120),
    address: 'r'.repeat(180),
    addressFa: fa(180),
    text: 'b'.repeat(2000),
    textFa: fa(2000),
    pdfUrl: `https://${'p'.repeat(480)}`,
    startsOn: '2026-11-02',
    endsOn: '2026-12-02',
    updatedAt: '2026-11-02T21:00:00.000Z',
    works,
  }
}

test(`HAD-122 the widest ${MAX_WORKS}-work publish body fits the ${JSON_LIMIT} JSON limit`, async () => {
  const record = widestRecord()
  const sent = Buffer.byteLength(publishBody(record.slug, undefined, record))
  const withImageSet = Buffer.byteLength(JSON.stringify({ gallery: record.slug, record }))
  assert.ok(sent < JSON_LIMIT_BYTES, `${sent} bytes is over the ${JSON_LIMIT_BYTES} byte limit`)
  assert.ok(withImageSet > sent, 'dropping imageSet must shrink the body')

  const owned = { ...widestRecord('o-gallery'), logo: null }
  const body = publishBody('o-gallery', undefined, owned)
  assert.ok(Buffer.byteLength(body) > JSON_LIMIT_BYTES / 2, 'the probe body must be large enough to prove the limit')
  await withStaff(async ({ app, cookie }) => {
    const res = await request(app)
      .put('/api/v1/pilot')
      .set('Host', 'localhost').set('Origin', 'http://localhost')
      .set('Cookie', cookie)
      .set('Content-Type', 'application/json')
      .send(body)
    // The images belong to no gallery here, so 400 is the answer. 413 would mean the body was cut off.
    assert.equal(res.status, 400)
    assert.equal(res.body.error, 'Use an image you upload. Do not use another gallery’s images.')
  })
})

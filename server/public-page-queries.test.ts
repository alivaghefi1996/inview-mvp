import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.PUBLIC_RECORD_TTL_MS = '5000'
delete process.env.O_GALLERY_ACCESS_CODE

import { eq } from 'drizzle-orm'
import { loadGalleryPage, loadWorkPage } from '../app/routes/pilot.server.ts'
import { DatabaseContext } from '../database/context.ts'
import { galleries } from '../database/schema.ts'
import { ensureOGalleryTenant } from './gallery-bootstrap.ts'
import { clearPublicRecordCache, loadPublicPage, PUBLIC_RECORD_TTL_MS } from './gallery-record.ts'
import { handlePilotApi } from './pilot-api.ts'
import { createTestDb } from './test-db.ts'

type TestDb = Awaited<ReturnType<typeof createTestDb>>

const WORK_ID = 'warmpagework1'

const WORK = {
  id: WORK_ID,
  title: 'Harbour light',
  titleFa: 'نور بندر',
  artist: 'N. Karimi',
  medium: 'Oil',
  size: '40 x 50',
  year: '2024',
  price: 1000000,
  status: 'available',
  image: '',
  sample: false,
}

function queryLog(testDb: TestDb): string[] {
  const client = testDb.client as unknown as { query: (...args: unknown[]) => unknown }
  const sent: string[] = []
  const original = client.query.bind(client)
  client.query = (...args: unknown[]) => {
    sent.push(String(args[0]).replace(/\s+/g, ' '))
    return original(...args)
  }
  return sent
}

function pageRequest(path: string) {
  return new Request(`http://inview.test${path}`)
}

async function withWarmGallery(
  fn: (args: {
    testDb: TestDb
    run: <T>(task: () => Promise<T>) => Promise<T>
    publish: (showTitle: string) => Promise<void>
  }) => Promise<void>,
) {
  const testDb = await createTestDb()
  try {
    const tenant = await ensureOGalleryTenant(testDb.db)
    const run = <T>(task: () => Promise<T>) => DatabaseContext.run(testDb.db, task)
    const publish = async (showTitle: string) => {
      const result = await handlePilotApi(testDb.db, testDb.storage, 'PUT', {
        accessCode: 'inview',
        gallery: tenant.gallery.slug,
        record: { name: 'O Gallery', nameFa: 'گالری اُ', showTitle, works: [WORK] },
      })
      assert.equal(result.status, 200)
    }
    await publish('Quiet Surfaces')
    await run(() => loadGalleryPage(pageRequest('/g/o-gallery'), 'o-gallery'))
    await fn({ testDb, run, publish })
  } finally {
    await testDb.close()
  }
}

test('a warm public page request makes no query inside the TTL', async () => {
  await withWarmGallery(async ({ testDb, run }) => {
    const sent = queryLog(testDb)

    const layout = await run(() => loadGalleryPage(pageRequest('/g/o-gallery'), 'o-gallery'))
    const show = await run(() => loadGalleryPage(pageRequest('/g/o-gallery'), 'o-gallery'))
    assert.deepEqual(sent, [])
    assert.equal(show.pilot?.showTitle, 'Quiet Surfaces')
    assert.equal(show.pilot, layout.pilot)

    await run(() => loadGalleryPage(pageRequest('/g/o-gallery/works'), 'o-gallery'))
    await run(() => loadGalleryPage(pageRequest('/g/o-gallery/works'), 'o-gallery'))
    const work = await run(() => loadWorkPage(pageRequest(`/g/o-gallery/works/${WORK_ID}`), 'o-gallery', WORK_ID))
    assert.equal(work.work?.title, 'Harbour light')
    assert.deepEqual(sent, [])
  })
})

test('after the TTL one query checks the stamp and keeps the catalogue', async () => {
  await withWarmGallery(async ({ testDb }) => {
    const warm = await loadPublicPage(testDb.db, 'o-gallery')
    const sent = queryLog(testDb)
    const expired = Date.now() + PUBLIC_RECORD_TTL_MS + 1
    const again = await loadPublicPage(testDb.db, 'o-gallery', expired)
    assert.equal(sent.length, 1)
    assert.equal(again, warm)

    sent.length = 0
    assert.equal(await loadPublicPage(testDb.db, 'o-gallery', expired), warm)
    assert.deepEqual(sent, [])
  })
})

test('two page loaders in one cold request share a single catalogue read', async () => {
  await withWarmGallery(async ({ testDb, run }) => {
    clearPublicRecordCache(testDb.db)
    const sent = queryLog(testDb)
    const request = pageRequest('/g/o-gallery')
    const [layout, show] = await Promise.all([
      run(() => loadGalleryPage(request, 'o-gallery')),
      run(() => loadGalleryPage(request, 'o-gallery')),
    ])
    assert.equal(show.pilot, layout.pilot)
    assert.equal(sent.length, 2)
  })
})

test('publishing shows the new catalogue on this pod without waiting for the TTL', async () => {
  await withWarmGallery(async ({ run, publish }) => {
    await publish('Salt and Light')
    const show = await run(() => loadGalleryPage(pageRequest('/g/o-gallery'), 'o-gallery'))
    assert.equal(show.pilot?.showTitle, 'Salt and Light')
  })
})

test('a paused gallery leaves a warm pod when the TTL ends', async () => {
  await withWarmGallery(async ({ testDb }) => {
    const base = Date.now()
    const warm = await loadPublicPage(testDb.db, 'o-gallery', base)
    await testDb.db.update(galleries).set({ status: 'paused' }).where(eq(galleries.slug, 'o-gallery'))
    assert.equal(await loadPublicPage(testDb.db, 'o-gallery', base), warm)
    assert.equal(await loadPublicPage(testDb.db, 'o-gallery', base + PUBLIC_RECORD_TTL_MS + 1), null)

    await testDb.db.update(galleries).set({ status: 'live' }).where(eq(galleries.slug, 'o-gallery'))
    assert.equal((await loadPublicPage(testDb.db, 'o-gallery'))?.record.slug, 'o-gallery')
  })
})

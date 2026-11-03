import { createElement, type FunctionComponent } from 'react'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import request from 'supertest'
import { CONSENT_TEXT_VERSION, leadBody } from '../app/lib/consent.ts'
import { staffT } from '../app/lib/i18n-staff.ts'
import { loadGalleryPage, loadWorkPage } from '../app/routes/pilot.server.ts'
import StaffQr, { loader as staffQrLoader } from '../app/routes/staff.qr.tsx'
import StaffTeam, { loader as staffTeamLoader } from '../app/routes/staff.team.tsx'
import { DatabaseContext, type AppDatabase } from '../database/context.ts'
import { auditLogs, galleries, leads, media, memberships, qrCodes, shows, showWorks, users, visits, works } from '../database/schema.ts'
import { createUser, createUserSession } from './accounts.ts'
import { createApiApp } from './api-app.ts'
import { hashSecret } from './crypto.ts'
import {
  isDemoGallery,
  leadsCsvForSession,
  loadPublicRecord,
  loadStaffRecord,
  publishGalleryRecordForSession,
  readStaffReportForSession,
  recordLead,
  recordVisit,
  tenantById,
  tenantBySlug,
} from './gallery-record.ts'
import { rateLimitConfig, runPilotRequest } from './rate-limit.ts'
import { signInWithAccessCode } from './staff-session.ts'
import { createTestDb } from './test-db.ts'
import { renderStaff } from './test-render.ts'

process.env.PUBLIC_APP_URL = 'http://localhost'
process.env.PUBLIC_RECORD_TTL_MS = '0'

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

async function fixture() {
  const testDb = await createTestDb()
  const { db, storage } = testDb
  const tenants = []
  for (const [index, slug] of ['tenant-a', 'tenant-b'].entries()) {
    const code = `code-${slug}`
    const [gallery] = await db.insert(galleries).values({ slug, nameEn: slug, nameFa: slug, accessCodeHash: hashSecret(code) }).returning()
    const [show] = await db.insert(shows).values({ galleryId: gallery.id, titleEn: `${slug}-show` }).returning()
    const workId = `${slug}-work`
    await db.insert(works).values({ id: workId, galleryId: gallery.id, title: `${slug}-title`, priceToman: 1000 })
    await db.insert(showWorks).values({ showId: show.id, workId })
    const [qr] = await db.insert(qrCodes).values({ showId: show.id, code: `${slug}-qr` }).returning()
    const tenant = (await tenantById(db, gallery.id))!
    const visitorId = `${slug}-visitor`
    const phone = `0912000000${index}`
    assert.equal((await recordVisit(db, tenant, 'scan', visitorId, null, qr.code)).status, 200)
    assert.equal((await recordVisit(db, tenant, 'view', visitorId, workId)).status, 200)
    assert.equal((await recordLead(db, tenant, phone, 'ask', visitorId, workId, true, CONSENT_TEXT_VERSION)).status, 200)
    const session = await signInWithAccessCode(db, code, slug)
    assert.ok(session)
    tenants.push({ tenant, workId, qr, visitorId, phone, code, cookie: `inview_staff=${session.token}` })
  }
  return { ...testDb, tenants, app: createApiApp(db, storage) }
}

for (const index of [0, 1]) {
  test(`tenant ${index} public reads, staff reports and CSV contain only its own rows`, async () => {
    const f = await fixture()
    try {
      const own = f.tenants[index]
      const other = f.tenants[1 - index]
      const id = own.tenant.gallery.id
      assert.equal((await tenantBySlug(f.db, own.tenant.gallery.slug))?.gallery.id, id)
      const record = await loadPublicRecord(f.db, own.tenant)
      assert.deepEqual(record.record.works.map((work) => work.id), [own.workId])
      assert.equal(JSON.stringify(record).includes(other.tenant.gallery.slug), false)
      assert.equal(JSON.stringify(record).includes(own.phone), false)
      const page = await DatabaseContext.run(f.db, () => loadGalleryPage(new Request(`http://inview.test/g/${own.tenant.gallery.slug}`), own.tenant.gallery.slug))
      assert.deepEqual(page.pilot?.works.map((work) => work.id), [own.workId])
      const report = await readStaffReportForSession(f.db, id)
      assert.equal(report.status, 200)
      if (report.status !== 200) throw new Error('Missing report')
      assert.deepEqual(report.body.visits, { scans: 1, views: 1 })
      assert.deepEqual(report.body.works.map((work) => work.workId), [own.workId])
      assert.deepEqual(report.body.leads.map((lead) => lead.phone), [own.phone])
      assert.equal(JSON.stringify(report).includes(other.workId), false)
      const csv = await leadsCsvForSession(f.db, id)
      assert.equal(csv.status, 200)
      assert.ok(String(csv.body).includes(own.phone))
      assert.ok(String(csv.body).includes(own.workId))
      assert.equal(String(csv.body).includes(other.phone), false)
      assert.equal(String(csv.body).includes(other.workId), false)
      const httpReport = await request(f.app).get('/api/v1/pilot/staff').query({ gallery: own.tenant.gallery.slug }).set('Cookie', own.cookie)
      assert.equal(httpReport.status, 200)
      assert.deepEqual(httpReport.body, { ...report.body, leads: report.body.leads.map((lead) => ({ ...lead, phone: '' })) })
      const httpCsv = await request(f.app).get('/api/v1/pilot/staff/leads.csv').query({ gallery: own.tenant.gallery.slug }).set('Cookie', own.cookie)
      assert.equal(httpCsv.status, 403)
      const publicApi = await request(f.app).get(`/api/v1/pilot?gallery=${own.tenant.gallery.slug}`)
      assert.equal(publicApi.status, 200)
      assert.deepEqual(publicApi.body, record)
    } finally {
      await f.close()
    }
  })

  test(`tenant ${index} cannot attach foreign works, QR codes, records or media`, async () => {
    const f = await fixture()
    try {
      const own = f.tenants[index]
      const other = f.tenants[1 - index]
      const otherBefore = await loadPublicRecord(f.db, other.tenant)
      assert.equal((await recordVisit(f.db, own.tenant, 'scan', `${own.visitorId}-cross`, null, other.qr.code)).status, 200)
      assert.equal((await recordVisit(f.db, own.tenant, 'view', own.visitorId, other.workId)).status, 200)
      const visitRows = await f.db.select().from(visits).where(eq(visits.showId, own.tenant.show.id))
      assert.equal(visitRows.length, 4)
      assert.ok(visitRows.every((row) => row.qrCodeId !== other.qr.id && row.workId !== other.workId))
      assert.equal((await recordLead(f.db, own.tenant, own.phone, 'save', own.visitorId, other.workId, true, CONSENT_TEXT_VERSION)).status, 400)
      assert.equal((await f.db.select().from(leads)).length, 2)
      const ownRecord = (await loadPublicRecord(f.db, own.tenant)).record
      const crossed = await publishGalleryRecordForSession(f.db, f.storage, own.tenant.gallery.id, { ...ownRecord, works: otherBefore.record.works })
      assert.equal(crossed.status, 400)
      assert.equal((await publishGalleryRecordForSession(f.db, f.storage, own.tenant.gallery.id, otherBefore.record)).status, 400)
      const crossApi = await request(f.app).put('/api/v1/pilot').set('Cookie', own.cookie).send({ gallery: other.tenant.gallery.slug, record: otherBefore.record })
      assert.equal(crossApi.status, 403)
      const wrongCode = await request(f.app).put('/api/v1/pilot').send({ gallery: other.tenant.gallery.slug, accessCode: own.code, record: otherBefore.record })
      assert.equal(wrongCode.status, 401)
      const foreignUpload = await request(f.app).post('/api/v1/uploads').set('Cookie', own.cookie).send({ gallery: other.tenant.gallery.slug, dataBase64: PNG })
      assert.equal(foreignUpload.status, 403)
      assert.equal((await f.db.select().from(media)).length, 0)
      const ownUpload = await request(f.app).post('/api/v1/uploads').set('Host', 'localhost').set('Origin', 'http://localhost').set('Cookie', own.cookie).send({ gallery: own.tenant.gallery.slug, dataBase64: PNG })
      assert.equal(ownUpload.status, 201)
      const [uploaded] = await f.db.select().from(media)
      assert.equal(uploaded.galleryId, own.tenant.gallery.id)
      assert.ok(uploaded.s3Key.includes(`/galleries/${own.tenant.gallery.slug}/`))
      const stolen = await publishGalleryRecordForSession(f.db, f.storage, other.tenant.gallery.id, {
        ...otherBefore.record, works: [{ ...otherBefore.record.works[0], image: ownUpload.body.url }],
      })
      assert.equal(stolen.status, 400)
      const published = await publishGalleryRecordForSession(f.db, f.storage, own.tenant.gallery.id, {
        ...ownRecord, name: `${own.tenant.gallery.slug}-changed`, works: [{ ...ownRecord.works[0], image: ownUpload.body.url }],
      })
      assert.equal(published.status, 200)
      assert.deepEqual(await loadPublicRecord(f.db, other.tenant), otherBefore)
      const [ownWork] = await f.db.select().from(works).where(eq(works.id, own.workId))
      assert.equal(ownWork.mediaId, uploaded.id)
      await assert.rejects(
        DatabaseContext.run(f.db, () => loadWorkPage(new Request('http://inview.test/g/'), own.tenant.gallery.slug, other.workId)),
        (error: unknown) => error instanceof Response && error.status === 404,
      )
    } finally {
      await f.close()
    }
  })
}

for (const index of [0, 1]) {
  test(`slug-aware staff APIs authorize every role and isolate tenant ${index}`, async () => {
    const f = await fixture()
    const db = f.db as unknown as AppDatabase
    try {
      const own = f.tenants[index]
      const other = f.tenants[1 - index]
      const slug = own.tenant.gallery.slug
      const record = (await loadStaffRecord(db, own.tenant)).record
      const cookies: Record<string, string> = { anonymous: '', shared: own.cookie, foreignShared: other.cookie }
      const ids: Record<string, string> = {}
      for (const role of ['owner', 'editor', 'viewer', 'other', 'admin', 'support'] as const) {
        const user = await createUser(db, { email: `${role}@isolation.test`, password: 'account-password', platformRole: role === 'admin' || role === 'support' ? role : null })
        ids[role] = user.id
        if (role !== 'admin' && role !== 'support') await db.insert(memberships).values({ userId: user.id, galleryId: role === 'other' ? other.tenant.gallery.id : own.tenant.gallery.id, role: role === 'other' ? 'owner' : role })
        cookies[role] = (await createUserSession(db, user.id, false)).cookie
      }
      const otherBefore = await loadPublicRecord(db, other.tenant)
      for (const [role, cookie] of Object.entries(cookies)) {
        const allowedWrite = ['owner', 'editor', 'admin', 'support', 'shared'].includes(role)
        const allowedRead = allowedWrite || role === 'viewer'
        const expectedDenied = role === 'anonymous' ? 401 : 403
        for (const path of ['/api/v1/pilot', '/api/pilot']) {
          const result = await request(f.app).put(path).set('Host', 'localhost').set('Origin', 'http://localhost').set('Cookie', cookie).send({ gallery: slug, record })
          assert.equal(result.status, allowedWrite ? 200 : expectedDenied, `${role} ${path}`)
          if (allowedWrite) assert.equal(result.body.record.slug, slug)
        }
        const upload = await request(f.app).post(`/api/v1/uploads?gallery=${slug}`).set('Host', 'localhost').set('Origin', 'http://localhost').set('Cookie', cookie).send({ dataBase64: PNG })
        assert.equal(upload.status, allowedWrite ? 201 : expectedDenied, `${role} upload`)
        if (allowedWrite) assert.ok(upload.body.url.includes(`/galleries/${slug}/`))
        const report = await request(f.app).get('/api/v1/pilot/staff').query({ gallery: slug }).set('Cookie', cookie)
        assert.equal(report.status, allowedRead ? 200 : expectedDenied, `${role} report`)
        const staffRecord = await request(f.app).get('/api/v1/pilot/staff/record').query({ gallery: slug }).set('Cookie', cookie)
        assert.equal(staffRecord.status, allowedRead ? 200 : expectedDenied, `${role} record`)
        if (allowedRead) assert.equal(staffRecord.body.record.slug, slug)
        if (allowedRead) {
          const expectedPhone = role === 'support' ? `${own.phone.slice(0, 4)}•••••${own.phone.slice(-2)}` : role === 'viewer' || role === 'shared' ? '' : own.phone
          assert.equal(report.body.leads[0].phone, expectedPhone)
          assert.equal(JSON.stringify(report.body).includes(other.phone), false)
          assert.equal(JSON.stringify(report.body).includes(other.workId), false)
        }
        const csv = await request(f.app).get('/api/v1/pilot/staff/leads.csv').query({ gallery: slug }).set('Cookie', cookie)
        const allowedCsv = ['owner', 'editor', 'admin'].includes(role)
        assert.equal(csv.status, allowedCsv ? 200 : expectedDenied, `${role} csv`)
        if (allowedCsv) {
          assert.ok(csv.text.includes(own.phone))
          assert.equal(csv.text.includes(other.phone), false)
          assert.ok(csv.headers['content-disposition'].includes(`${slug}-leads-`))
        }
      }
      for (const cookie of [cookies.owner, cookies.shared]) {
        const missing = await request(f.app).put('/api/v1/pilot').set('Cookie', cookie).send({ record })
        assert.equal(missing.status, 400)
        assert.equal((await request(f.app).post('/api/v1/uploads').set('Cookie', cookie).send({ dataBase64: PNG })).status, 400)
        assert.equal((await request(f.app).put('/api/v1/pilot').set('Cookie', cookie).send({ gallery: slug, record })).status, 403)
        assert.equal((await request(f.app).post('/api/v1/uploads').set('Cookie', cookie).send({ gallery: slug, dataBase64: PNG })).status, 403)
        assert.equal((await request(f.app).get('/api/v1/pilot/staff').query({ gallery: 'missing' }).set('Cookie', cookie)).status, 404)
      }
      assert.equal((await request(f.app).put('/api/v1/pilot').set('Host', 'localhost').set('Origin', 'http://localhost').set('Cookie', cookies.viewer).send({ gallery: slug, accessCode: own.code, record })).status, 403)
      const rows = await db.select().from(media)
      assert.equal(rows.length, 5)
      assert.ok(rows.every((row) => row.galleryId === own.tenant.gallery.id))
      assert.deepEqual(await loadPublicRecord(db, other.tenant), otherBefore)
      const logs = await db.select().from(auditLogs)
      assert.equal(logs.filter((row) => row.action === 'publish').length, 10)
      assert.equal(logs.filter((row) => row.action === 'upload-images').length, 5)
      assert.equal(logs.filter((row) => row.action === 'export-leads').length, 3)
      assert.ok(logs.every((row) => row.galleryId === own.tenant.gallery.id))
      assert.ok(logs.some((row) => row.actorUserId === ids.owner && row.action === 'publish'))
      assert.equal(logs.filter((row) => row.actorUserId === null && row.summary.kind === 'shared-code').length, 3)
      assert.equal(JSON.stringify(logs).includes(own.phone), false)
      await db.update(galleries).set({ sharedCodeEnabled: false }).where(eq(galleries.id, own.tenant.gallery.id))
      for (const path of ['/api/v1/pilot', '/api/pilot']) {
        assert.equal((await request(f.app).put(path).set('Cookie', cookies.shared).send({ gallery: slug, record })).status, 401)
        assert.equal((await request(f.app).put(path).send({ gallery: slug, record, accessCode: own.code })).status, 401)
      }
      assert.equal((await request(f.app).post('/api/v1/uploads').set('Cookie', cookies.shared).send({ gallery: slug, dataBase64: PNG })).status, 401)
      assert.equal((await request(f.app).get('/api/v1/pilot/staff').query({ gallery: slug }).set('Cookie', cookies.shared)).status, 401)
    } finally { await f.close() }
  })
}

for (const index of [0, 1]) {
  test(`tenant ${index} staff QR and team pages show only its own scan counts, status and last sign-in`, async () => {
    const f = await fixture()
    const db = f.db as unknown as AppDatabase
    try {
      const own = f.tenants[index]
      const other = f.tenants[1 - index]
      const slug = own.tenant.gallery.slug
      const [quiet] = await db.insert(qrCodes).values({ showId: own.tenant.show.id, code: `${slug}-quiet`, label: `${slug} quiet` }).returning()
      for (const visitor of ['second-visitor', 'third-visitor']) assert.equal((await recordVisit(db, own.tenant, 'scan', visitor, null, own.qr.code)).status, 200)
      assert.equal((await recordVisit(db, own.tenant, 'scan', 'no-code-visitor')).status, 200)
      assert.equal((await recordVisit(db, own.tenant, 'scan', 'foreign-code-visitor', null, other.qr.code)).status, 200)
      await db.insert(visits).values({ showId: own.tenant.show.id, kind: 'view', visitorId: 'quiet-visitor', qrCodeId: quiet.id, day: '2026-11-02' })

      const signedInAt = '2026-10-30T08:15:00.000Z'
      const roster = [
        { key: 'active', status: 'active', lastSignedInAt: new Date(signedInAt), gallery: own },
        { key: 'invited', status: 'invited', lastSignedInAt: null, gallery: own },
        { key: 'disabled', status: 'disabled', lastSignedInAt: null, gallery: own },
        { key: 'foreign', status: 'active', lastSignedInAt: new Date('2026-10-01T08:15:00.000Z'), gallery: other },
      ] as const
      const ids: Record<string, string> = {}
      for (const member of roster) {
        const user = await createUser(db, { email: `${member.key}@team.test`, password: 'account-password', name: `${slug}-${member.key}-person`, status: member.status })
        ids[member.key] = user.id
        await db.insert(memberships).values({ userId: user.id, galleryId: member.gallery.tenant.gallery.id, role: member.key === 'active' ? 'owner' : 'viewer' })
        await db.update(users).set({ lastSignedInAt: member.lastSignedInAt }).where(eq(users.id, user.id))
      }
      const owner = (await createUserSession(db, ids.active, false)).cookie
      await db.update(users).set({ lastSignedInAt: new Date(signedInAt) }).where(eq(users.id, ids.active))
      const invoke = <T>(loader: (args: { request: Request; params: { slug: string } }) => Promise<T>, path: string, cookie: string, gallery = slug) =>
        DatabaseContext.run(db, () => loader({ request: new Request(`http://localhost/staff/${gallery}/${path}`, { headers: { cookie } }), params: { slug: gallery } }))

      for (const cookie of [owner, own.cookie]) {
        const qr = await invoke(staffQrLoader, 'qr', cookie)
        assert.deepEqual(Object.fromEntries(qr.codes.map((code) => [code.code, code.scans])), { [own.qr.code]: 3, [quiet.code]: 0 })
        assert.equal(JSON.stringify(qr).includes(other.qr.code), false)
      }
      const team = await invoke(staffTeamLoader, 'team', owner)
      assert.deepEqual(
        team.team.map((member) => [member.userId, member.status, member.lastSignedInAt && new Date(member.lastSignedInAt).toISOString()]).sort(),
        [[ids.active, 'active', signedInAt], [ids.invited, 'invited', null], [ids.disabled, 'disabled', null]].sort(),
      )
      assert.equal(JSON.stringify(team).includes(ids.foreign), false)

      for (const [loader, path] of [[staffQrLoader, 'qr'], [staffTeamLoader, 'team']] as const) {
        await assert.rejects(invoke<unknown>(loader, path, owner, other.tenant.gallery.slug), (error: unknown) => error instanceof Response && error.status === 403)
      }
      const foreignSession = await signInWithAccessCode(db, other.code, other.tenant.gallery.slug)
      await assert.rejects(invoke<unknown>(staffQrLoader, 'qr', `inview_staff=${foreignSession!.token}`), (error: unknown) => error instanceof Response && error.status === 403)

      for (const lang of ['en', 'fa'] as const) {
        const { t, format } = staffT(lang)
        const scans = (count: number) => `${t.scans}: ${format.number(count)}`
        const page = (element: FunctionComponent, path: string, data: object) => renderStaff(createElement(element), lang, `/staff/${slug}/${path}`, undefined, data).replaceAll('<!-- -->', '')
        const qrHtml = page(StaffQr, 'qr', await invoke(staffQrLoader, 'qr', owner))
        assert.ok(qrHtml.includes(scans(3)), `${lang} scans of the used code`)
        assert.ok(qrHtml.includes(scans(0)), `${lang} scans of the unused code`)
        assert.equal(qrHtml.includes(other.qr.code), false)
        const teamHtml = page(StaffTeam, 'team', await invoke(staffTeamLoader, 'team', owner))
        for (const status of ['active', 'invited', 'disabled'] as const) assert.ok(teamHtml.includes(`${t[status]} · `), `${lang} ${status} status`)
        assert.ok(teamHtml.includes(`${t.lastSignIn}: ${format.dateTime(signedInAt)}`), `${lang} last sign-in`)
        assert.ok(teamHtml.includes(`${t.lastSignIn}: ${t.never}`), `${lang} no sign-in yet`)
        assert.equal(teamHtml.includes(`${slug}-foreign-person`), false)
      }
    } finally { await f.close() }
  })
}

for (const status of ['draft', 'paused'] as const) {
  test(`${status} galleries return localized 404s on visitor paths, including warmed caches`, async () => {
    const f = await fixture()
    try {
      for (const own of f.tenants) {
        await loadPublicRecord(f.db, own.tenant)
        await f.db.update(galleries).set({ status }).where(eq(galleries.id, own.tenant.gallery.id))
        await assert.rejects(loadPublicRecord(f.db, own.tenant), (error: unknown) => error instanceof Response && error.status === 404)
        for (const suffix of ['', '/works', '/prices', '/about']) {
          await assert.rejects(
            DatabaseContext.run(f.db, () => loadGalleryPage(new Request(`http://inview.test/g/${own.tenant.gallery.slug}${suffix}`), own.tenant.gallery.slug)),
            (error: unknown) => error instanceof Response && error.status === 404,
          )
        }
        const read = await request(f.app).get(`/api/v1/pilot?gallery=${own.tenant.gallery.slug}`)
        assert.equal(read.status, 404)
        assert.equal(typeof read.body.errorFa, 'string')
        for (const body of [
          { op: 'visit', kind: 'scan', visitorId: own.visitorId },
          leadBody({ phone: own.phone, kind: 'ask', visitorId: own.visitorId, workId: own.workId }),
        ]) {
          const response = await request(f.app).post('/api/v1/pilot').send({ ...body, gallery: own.tenant.gallery.slug })
          assert.equal(response.status, 404)
          assert.equal(typeof response.body.errorFa, 'string')
        }
        const limits = rateLimitConfig({ NODE_ENV: 'test', RATE_LIMIT_VISIT_VISITOR_MAX: '1' })
        for (let attempt = 0; attempt < 2; attempt += 1) {
          assert.equal((await runPilotRequest(f.db, f.storage, 'POST', { op: 'visit', kind: 'scan', visitorId: own.visitorId, gallery: own.tenant.gallery.slug }, '127.0.0.1', new Date(), limits)).status, 404)
        }
        assert.equal((await recordVisit(f.db, own.tenant, 'view', own.visitorId, own.workId)).status, 404)
        assert.equal((await recordLead(f.db, own.tenant, own.phone, 'ask', own.visitorId, own.workId, true, CONSENT_TEXT_VERSION)).status, 404)
        const staff = await loadStaffRecord(f.db, (await tenantById(f.db, own.tenant.gallery.id))!)
        assert.equal(staff.record.slug, own.tenant.gallery.slug)
        assert.equal((await publishGalleryRecordForSession(f.db, f.storage, own.tenant.gallery.id, staff.record)).status, 200)
      }
      assert.equal((await f.db.select().from(visits)).length, 4)
      assert.equal((await f.db.select().from(leads)).length, 2)
    } finally {
      await f.close()
    }
  })
}

test('demo status comes from the row and tenant resolution does not bootstrap a missing gallery', async () => {
  const f = await fixture()
  try {
    assert.equal(await tenantBySlug(f.db, 'o-gallery'), null)
    assert.equal((await request(f.app).get('/api/v1/pilot?gallery=o-gallery')).status, 404)
    assert.equal((await request(f.app).put('/api/v1/pilot').send({ gallery: 'x'.repeat(300), accessCode: 'wrong' })).status, 404)
    assert.equal((await f.db.select().from(galleries)).length, 2)
    const own = f.tenants[0]
    assert.equal(isDemoGallery(own.tenant.gallery), false)
    await f.db.update(galleries).set({ isDemo: true, updatedAt: new Date(Date.now() + 1000) }).where(eq(galleries.id, own.tenant.gallery.id))
    assert.equal((await loadPublicRecord(f.db, own.tenant)).record.demo, true)
  } finally {
    await f.close()
  }
})

test('the demo migration backfills existing sample rows and defaults other galleries to false', async () => {
  const f = await createTestDb()
  try {
    await f.client.exec("ALTER TABLE galleries DROP COLUMN is_demo; INSERT INTO galleries (slug, name_en, name_fa) VALUES ('sample', 'Sample', 'Sample'), ('real-gallery', 'Real', 'Real')")
    await f.client.exec(await readFile(new URL('../drizzle/0007_gallery_demo.sql', import.meta.url), 'utf8'))
    const rows = await f.db.select({ slug: galleries.slug, demo: galleries.isDemo }).from(galleries)
    assert.deepEqual(Object.fromEntries(rows.map((row) => [row.slug, row.demo])), { sample: true, 'real-gallery': false })
    await f.db.insert(galleries).values({ slug: 'new-gallery', nameEn: 'New', nameFa: 'New' })
    const [created] = await f.db.select().from(galleries).where(eq(galleries.slug, 'new-gallery'))
    assert.equal(created.isDemo, false)
  } finally {
    await f.close()
  }
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createUser, signIn } from './accounts'
import { galleries, leads } from '../database/schema'
import { exportGalleryLeads, galleryLeads } from './ops-data'
import { recordLead } from './gallery-record'
import { createTestDb } from './test-db'

const MIGRATION = readFileSync(new URL('../drizzle/0010_phone_e164.sql', import.meta.url), 'utf8')

test('the migration converts old Iranian numbers and leaves every other value alone', async () => {
  const fixture = await createTestDb()
  try {
    const { client, db } = fixture
    const [gallery] = await db.insert(galleries).values({ slug: 'phone-gallery', nameEn: 'Phone', nameFa: 'Phone' }).returning()
    await db.insert(leads).values(['09120000001', '+4915112345678', 'oldest-excluded'].map((phone) => ({
      galleryId: gallery.id, phone, kind: 'ask' as const, consentAt: new Date(), consentTextVersion: 'v1',
    })))
    await client.exec("INSERT INTO users (phone) VALUES ('09120000002'), ('09120000003'), ('+989120000003'), ('+14155552671')")
    await client.exec("INSERT INTO otp_challenges (phone, code_hash, expires_at) VALUES ('09120000004', 'hash', now())")

    await client.exec(MIGRATION)
    await client.exec(MIGRATION)

    const column = async (table: string) => (await client.query(`SELECT phone FROM ${table} ORDER BY phone`)).rows.map((row) => (row as { phone: string }).phone).sort()
    assert.deepEqual(await column('leads'), ['+4915112345678', '+989120000001', 'oldest-excluded'].sort())
    assert.deepEqual(await column('users'), ['+14155552671', '+989120000002', '+989120000003', '09120000003'].sort())
    assert.deepEqual(await column('otp_challenges'), ['+989120000004'])
  } finally {
    await fixture.close()
  }
})

test('sign-in finds a row in either form from either typed form', async () => {
  const fixture = await createTestDb()
  try {
    const { client, db } = fixture
    await createUser(db, { phone: '+989120000010', password: 'long-password' })
    await createUser(db, { phone: '+447911123456', password: 'long-password' })
    const legacy = await createUser(db, { phone: '+989120000011', password: 'long-password' })
    await client.query('UPDATE users SET phone = $1 WHERE id = $2', ['09120000011', legacy.id])

    const attempt = (identifier: string, ip: string) => signIn(db, { identifier, password: 'long-password', ip, secure: false })
    assert.ok((await attempt('09120000010', 'a')).ok)
    assert.ok((await attempt('+989120000010', 'b')).ok)
    assert.ok((await attempt('۰۹۱۲۰۰۰۰۰۱۰', 'c')).ok)
    assert.ok((await attempt('09120000011', 'd')).ok)
    assert.ok((await attempt('+989120000011', 'e')).ok)
    assert.ok((await attempt('+44 7911 123456', 'f')).ok)
  } finally {
    await fixture.close()
  }
})

test('createUser rejects a number with no valid country plan', async () => {
  const fixture = await createTestDb()
  try {
    await assert.rejects(createUser(fixture.db, { phone: '+4915', password: 'long-password' }))
    await assert.rejects(createUser(fixture.db, { phone: 'not a phone', password: 'long-password' }))
  } finally {
    await fixture.close()
  }
})

test('operator views read old and new rows in one form', async () => {
  const fixture = await createTestDb()
  try {
    const { db } = fixture
    const [gallery] = await db.insert(galleries).values({ slug: 'mixed-gallery', nameEn: 'Mixed', nameFa: 'Mixed' }).returning()
    await db.insert(leads).values(['09120000021', '+4915112345678'].map((phone) => ({
      galleryId: gallery.id, phone, kind: 'ask' as const, consentAt: new Date(), consentTextVersion: 'v1',
    })))
    const user = await createUser(db, { email: 'admin@example.com', platformRole: 'admin' })
    const admin = { kind: 'operator' as const, userId: user.id, platformRole: 'admin' as const }
    const masked = (await galleryLeads(db, admin, gallery.id)).map((row) => row.phone).sort()
    assert.deepEqual(masked, ['+49151•••••78', '+98912•••••21'].sort())
    const csv = await exportGalleryLeads(db, admin, gallery.id)
    assert.ok(csv.includes(',ask,+989120000021,'))
    assert.ok(csv.includes(',ask,+4915112345678,'))
  } finally {
    await fixture.close()
  }
})

test('recordLead reports a bad number with a code the sheet can read', async () => {
  const fixture = await createTestDb()
  try {
    const tenant = { gallery: { id: '00000000-0000-4000-8000-000000000002' } } as Parameters<typeof recordLead>[1]
    const result = await recordLead(fixture.db, tenant, '+493012345678', 'ask', 'visitor-001', 'work-0001', true, 'v1')
    assert.equal(result.status, 400)
    assert.deepEqual(result.body, { error: 'Enter a valid mobile number with its country code.', code: 'invalid_phone' })
  } finally {
    await fixture.close()
  }
})

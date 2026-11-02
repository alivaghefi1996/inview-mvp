import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { expect, test as base, type Browser, type Page } from '@playwright/test'
import { CONSENT_TEXT_VERSION } from '../app/lib/consent'
import * as schema from '../database/schema'
import { hashSecret } from '../server/crypto'

type Owner = { slug: string; email: string; password: string; code: string; workA: string; workB: string }

const test = base.extend<{ owner: Owner }>({
  owner: async ({}, use) => {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is required for shows e2e tests.')
    const sql = postgres(url, { max: 1 })
    const db = drizzle(sql, { schema })
    const id = randomUUID().slice(0, 8)
    const slug = `shows-${id}`
    const email = `owner-${slug}@example.com`
    const password = randomUUID()
    const code = `${slug}-door`
    let galleryId = ''
    try {
      galleryId = await db.transaction(async (tx) => {
        const [gallery] = await tx.insert(schema.galleries).values({ slug, nameEn: 'Shows gallery', nameFa: 'گالری نمایش‌ها', status: 'live', sharedCodeEnabled: false }).returning()
        const [show] = await tx.insert(schema.shows).values({ galleryId: gallery.id, status: 'published' }).returning()
        await tx.insert(schema.qrCodes).values({ showId: show.id, code, label: 'Door' })
        const [user] = await tx.insert(schema.users).values({ email, name: 'Shows owner', passwordHash: hashSecret(password) }).returning()
        await tx.insert(schema.memberships).values({ galleryId: gallery.id, userId: user.id, role: 'owner' })
        return gallery.id
      })
      await use({ slug, email, password, code, workA: `work-a-${id}`, workB: `work-b-${id}` })
    } finally {
      try {
        await db.delete(schema.auditLogs).where(eq(schema.auditLogs.galleryId, galleryId))
        await db.delete(schema.galleries).where(eq(schema.galleries.id, galleryId))
        await db.delete(schema.users).where(eq(schema.users.email, email))
      } finally {
        await sql.end({ timeout: 5 })
      }
    }
  },
})

test.use({ reducedMotion: 'reduce' })

function work(id: string, title: string) {
  return { id, title, artist: 'N. Karimi', medium: '', size: '', year: '', price: null, status: 'available', image: '', sample: false }
}

async function saveWork(page: Page, origin: string, slug: string, item: ReturnType<typeof work>, show?: string) {
  const query = `gallery=${slug}${show ? `&show=${show}` : ''}`
  const current = await page.request.get(`/api/v1/pilot/staff/record?${query}`)
  expect(current.ok()).toBeTruthy()
  const { record } = await current.json()
  const saved = await page.request.put('/api/v1/pilot', { headers: { Origin: origin }, data: { gallery: slug, show, record: { ...record, works: [item] } } })
  expect(saved.ok(), await saved.text()).toBeTruthy()
}

/** Each visitor has a new browser, as a phone at the door does. The scan goes to the current show. */
async function scan(browser: Browser, origin: string, owner: Owner, showTitle: string, lead?: { workId: string; phone: string }) {
  const context = await browser.newContext({ baseURL: origin, reducedMotion: 'reduce' })
  await context.addCookies([{ name: 'inview-lang', value: 'en', url: origin }])
  const page = await context.newPage()
  const counted = page.waitForResponse((response) => response.url().includes('/api/v1/pilot') && response.request().method() === 'POST')
  await page.goto(`/g/${owner.slug}?q=${owner.code}`)
  await expect(page.getByRole('heading', { name: showTitle, exact: true })).toBeVisible()
  expect((await counted).status()).toBe(200)
  if (lead) {
    const visitorId = randomUUID()
    const sent = await page.request.post('/api/v1/pilot', {
      headers: { Origin: origin },
      data: { op: 'lead', gallery: owner.slug, kind: 'ask', phone: lead.phone, visitorId, workId: lead.workId, consent: true, consentTextVersion: CONSENT_TEXT_VERSION },
    })
    expect(sent.status(), await sent.text()).toBe(200)
  }
  await context.close()
}

async function expectTotals(page: Page, scans: string, leads: string) {
  const totals = page.locator('.staff-totals')
  await expect(totals.locator('div').filter({ hasText: 'Landing scans' }).locator('dd').first()).toHaveText(scans)
  await expect(totals.locator('div').filter({ hasText: 'Phone numbers' }).locator('dd').first()).toHaveText(leads)
}

test('one QR code opens show A, then show B, and each show keeps its own counts', async ({ page, browser, baseURL, owner }) => {
  test.setTimeout(120_000)
  const origin = new URL(baseURL || 'http://127.0.0.1:3000').origin
  await page.context().addCookies([{ name: 'inview-lang', value: 'en', url: origin }])

  await page.goto('/staff/sign-in')
  const form = page.locator('form').filter({ has: page.getByLabel('Email or phone') })
  await form.getByLabel('Email or phone').fill(owner.email)
  await form.getByLabel('Password').fill(owner.password)
  await form.getByRole('button', { name: 'Open the editor' }).click()
  await expect(page).toHaveURL(/\/staff/)

  await test.step('staff publish show A and two visitors scan the QR code', async () => {
    await page.goto(`/staff/${owner.slug}`)
    await page.getByLabel('Show title', { exact: true }).fill('Show A')
    const published = page.waitForResponse((response) => response.url().includes('/api/v1/pilot') && response.request().method() === 'PUT')
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    expect((await published).status()).toBe(200)
    await saveWork(page, origin, owner.slug, work(owner.workA, 'Work of show A'))

    await scan(browser, origin, owner, 'Show A', { workId: owner.workA, phone: '09120000101' })
    await scan(browser, origin, owner, 'Show A')
  })

  let showB = ''
  await test.step('staff start show B, and visitors still see show A', async () => {
    await page.goto(`/staff/${owner.slug}/shows`)
    await page.getByRole('button', { name: 'Start a new show' }).click()
    await expect(page).toHaveURL(/\?show=/)
    showB = new URL(page.url()).searchParams.get('show') ?? ''
    await page.getByLabel('Show title', { exact: true }).fill('Show B')
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'The draft is saved.' })).toBeVisible()
    await saveWork(page, origin, owner.slug, work(owner.workB, 'Work of show B'), showB)

    await scan(browser, origin, owner, 'Show A')
  })

  await test.step('staff publish show B, and the same QR code opens it', async () => {
    await page.goto(`/staff/${owner.slug}/shows`)
    const draft = page.locator('.show-row').filter({ hasText: 'Show B' })
    await draft.getByRole('button', { name: 'Publish this show' }).click()
    await draft.getByRole('button', { name: 'Yes, continue' }).click()
    await expect(page.locator('.show-row-published').getByRole('heading', { name: 'Show B' })).toBeVisible()
    await expect(page.locator('.show-row-archived').getByRole('heading', { name: 'Show A' })).toBeVisible()

    await scan(browser, origin, owner, 'Show B', { workId: owner.workB, phone: '09120000102' })
    await scan(browser, origin, owner, 'Show B', { workId: owner.workB, phone: '09120000103' })
  })

  await test.step('each report has separate counts, and the archived report stays open', async () => {
    await page.goto(`/staff/${owner.slug}/report`)
    await expectTotals(page, '2', '2')
    await expect(page.getByText('+989120000101')).toHaveCount(0)

    await page.goto(`/staff/${owner.slug}/shows`)
    const archived = page.locator('.show-row-archived')
    await expect(archived.getByRole('link', { name: /^Edit/ })).toHaveCount(0)
    await archived.getByRole('link', { name: /^Open report/ }).click()
    await expect(page).toHaveURL(/report\?show=/)
    await expectTotals(page, '3', '1')
    await expect(page.getByText('+989120000102')).toHaveCount(0)
    const csv = await page.request.get(new URL(await page.getByRole('link', { name: 'Download CSV' }).getAttribute('href') ?? '', origin).href)
    expect(await csv.text()).toContain('+989120000101')
    expect(await csv.text()).not.toContain('+989120000102')
  })

  await test.step('the staff QR page still lists the printed code, with all its scans', async () => {
    await page.goto(`/staff/${owner.slug}/qr`)
    await expect(page.getByRole('listitem').filter({ hasText: 'Door' }).getByText('Landing scans: 5')).toBeVisible()
  })

  await test.step('staff archive the current show, and the QR code shows a message', async () => {
    await page.goto(`/staff/${owner.slug}/shows`)
    const current = page.locator('.show-row-published')
    await current.getByRole('button', { name: 'Archive this show' }).click()
    await current.getByRole('button', { name: 'Yes, continue' }).click()
    await expect(page.locator('.show-row-published')).toHaveCount(0)

    await page.goto(`/g/${owner.slug}?q=${owner.code}`)
    await expect(page).toHaveURL(new RegExp(`/g/${owner.slug}/closed$`))
    await expect(page.getByRole('heading', { name: 'No show is open now' })).toBeVisible()
    await expect(page.getByText('Shows gallery')).toBeVisible()
  })
})

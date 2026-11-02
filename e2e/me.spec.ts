import AxeBuilder from '@axe-core/playwright'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { expect, test, type Page } from '@playwright/test'
import { DEMO_SLUG } from '../app/lib/galleries'
import { seedCatalogue } from './seed-catalogue'

const workId = 'mepagework1'
const qrCode = `me-${randomUUID().slice(0, 8)}`

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 390, height: 844 } })

async function useEnglish(page: Page, baseURL?: string) {
  await page.context().addCookies([{ name: 'inview-lang', value: 'en', url: baseURL || 'http://127.0.0.1:3000' }])
}

async function saveWithPhone(page: Page) {
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('textbox', { name: 'Mobile number', exact: true }).fill('09123335555')
  await page.getByRole('checkbox').check()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible()
}

test.beforeAll(async () => {
  await seedCatalogue({
    name: 'O Gallery',
    nameFa: 'گالری اُ',
    showTitle: 'Me show',
    works: [{ id: workId, title: 'Quiet orchard', titleFa: 'باغ آرام', artist: 'L. Moradi', status: 'available' }],
  })
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 })
  try {
    const [show] = await sql`select s.id from shows s join galleries g on g.id = s.gallery_id
      where g.slug = 'o-gallery' order by s.created_at desc, s.id desc limit 1`
    await sql`insert into qr_codes (show_id, label, code) values (${show.id}, 'Me spec', ${qrCode})`
  } finally {
    await sql.end()
  }
})

test.afterAll(async () => {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 })
  try {
    await sql`delete from qr_codes where code = ${qrCode}`
  } finally {
    await sql.end()
  }
  await seedCatalogue({ works: [] })
})

test('a real scan and a real save reach /me without demo items', async ({ page, baseURL }) => {
  await useEnglish(page, baseURL)
  const scan = page.waitForResponse((response) => response.url().includes('/api/v1/pilot') && (response.request().postData() || '').includes('"kind":"scan"'))
  await page.goto(`/g/o-gallery?q=${qrCode}`)
  await scan
  await page.goto(`/g/o-gallery/works/${workId}`)
  await saveWithPhone(page)

  await page.locator('.v-tabs').getByRole('link', { name: 'My Inview' }).click()
  await expect(page).toHaveURL(/\/me$/)
  await expect(page.locator('.saved').getByRole('link', { name: /Quiet orchard/ })).toHaveAttribute('href', `/g/o-gallery/works/${workId}`)
  await expect(page.locator('.stamps .stamp')).toHaveCount(1)
  await expect(page.locator('.stamps .stamp')).toContainText('O Gallery')
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reset demo' })).toHaveCount(0)
  await expect(page.getByText('Openings', { exact: true })).toHaveCount(0)
  await expect(page.locator('.v-tabs a[href="/g/o-gallery"]')).toHaveCount(1)
  const axe = await new AxeBuilder({ page }).analyze()
  expect(axe.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical').map((item) => item.id)).toEqual([])

  await page.goto(`/g/o-gallery?q=${qrCode}`)
  await page.goto('/me')
  await expect(page.locator('.stamps .stamp')).toHaveCount(1)
})

test('opening a gallery without a known QR code adds no stamp', async ({ page, baseURL }) => {
  await useEnglish(page, baseURL)
  const scan = () => page.waitForResponse((response) => response.url().includes('/api/v1/pilot') && (response.request().postData() || '').includes('"kind":"scan"'))
  const plain = scan()
  await page.goto('/g/o-gallery')
  await plain
  const unknown = scan()
  await page.goto('/g/o-gallery?q=no-such-code')
  await unknown
  await page.goto(`/g/o-gallery/works/${workId}`)
  await saveWithPhone(page)
  await page.goto('/me')
  await expect(page.locator('.saved').getByRole('link', { name: /Quiet orchard/ })).toBeVisible()
  await expect(page.locator('.stamps .stamp')).toHaveCount(0)
  await expect(page.getByText('Scan the QR code at a gallery')).toBeVisible()
})

test('the Rooz demo keeps its passport history, Openings and Reset demo', async ({ page, baseURL }) => {
  await useEnglish(page, baseURL)
  await page.goto(`/g/${DEMO_SLUG}`)
  await expect(page.locator('.v-top')).toBeVisible()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('inview-demo-v1') || '')).toContain(DEMO_SLUG)
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('inview-demo-v1') || '{}')
    localStorage.setItem('inview-demo-v1', JSON.stringify({ ...state, phone: '09123335555', consentVersion: 'any' }))
  })
  await page.goto('/me')
  await expect(page.getByRole('progressbar')).toBeVisible()
  await expect(page.getByText('Openings', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reset demo' })).toBeVisible()
})

test('old saved entries without a snapshot do not break /me', async ({ page, baseURL }) => {
  await useEnglish(page, baseURL)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    localStorage.setItem('inview-demo-v1', JSON.stringify({ phone: '09123335555', saved: ['goneworkid1', 7, null], stamps: 'x', consentVersion: 'old' }))
  })
  await page.goto('/me')
  await expect(page.getByRole('heading', { name: 'My Inview' })).toBeVisible()
  await expect(page.getByText('Tap the heart on any work')).toBeVisible()
  expect(errors).toEqual([])
})

import { expect, test, type Page } from '@playwright/test'
import { PRIVACY_PATH } from '../app/lib/consent'
import { seedCatalogue } from './seed-catalogue'

const workId = 'privacywork1'

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 390, height: 844 } })

async function useLang(page: Page, lang: 'en' | 'fa', baseURL?: string) {
  await page.context().addCookies([{ name: 'inview-lang', value: lang, url: baseURL || 'http://127.0.0.1:3000' }])
}

test.beforeAll(async () => {
  await seedCatalogue({ name: 'O Gallery', nameFa: 'گالری اُ', showTitle: 'Privacy show', works: [{ id: workId, title: 'Still water', artist: 'R. Amini', status: 'available' }] })
})

test.afterAll(async () => {
  await seedCatalogue({ works: [] })
})

test('the privacy page opens in both languages without a sign-in', async ({ page, baseURL }) => {
  await page.goto(PRIVACY_PATH)
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa')
  await expect(page.getByRole('heading', { level: 1, name: 'حریم خصوصی' })).toBeVisible()
  await useLang(page, 'en', baseURL)
  await page.goto(PRIVACY_PATH)
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible()
  await expect(page.getByText('Contact the gallery')).toBeVisible()
})

test('the sign-in sheet names Inview and links the privacy page', async ({ page, baseURL }) => {
  await useLang(page, 'en', baseURL)
  await page.goto(`/g/o-gallery/works/${workId}`)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByRole('checkbox', { name: /This gallery and Inview may store/ })).toBeVisible()
  await expect(sheet.getByRole('link', { name: 'Read the privacy page' })).toHaveAttribute('href', PRIVACY_PATH)
})

test('a tab with an old consent version says the number did not arrive', async ({ page, baseURL }) => {
  await useLang(page, 'en', baseURL)
  await page.route('**/api/v1/pilot', async (route) => {
    const body = route.request().postDataJSON() as { op?: string }
    if (body.op !== 'lead') return route.continue()
    await route.continue({ postData: JSON.stringify({ ...body, consentTextVersion: '2026-11-01' }) })
  })
  await page.goto(`/g/o-gallery/works/${workId}`)
  await page.getByRole('button', { name: /Ask about this work/ }).click()
  await page.getByRole('textbox', { name: 'Mobile number', exact: true }).fill('09123336666')
  await page.getByRole('checkbox').check()
  const refused = page.waitForResponse((response) => response.url().includes('/api/v1/pilot') && response.status() === 400)
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click()
  await refused
  await expect(page.getByRole('alert')).toContainText('did not receive your number')
  await expect(page.getByRole('button', { name: /Ask about this work/ })).toBeVisible()
  await page.unroute('**/api/v1/pilot')
  await page.getByRole('button', { name: 'Reload' }).click()
  await page.getByRole('button', { name: /Ask about this work/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

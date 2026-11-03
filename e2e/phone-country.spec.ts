import { expect, test, type Page } from '@playwright/test'
import { CONSENT_TEXT_VERSION } from '../app/lib/consent'
import { hydrated } from './hydrated'
import { seedCatalogue } from './seed-catalogue'

const WORK_ID = 'phonework01'
const WORK_PATH = `/g/o-gallery/works/${WORK_ID}`

const copy = {
  en: { label: 'Mobile number', country: 'Country code', consent: /I agree/, confirm: 'Confirm', search: 'Search for a country', saved: 'Saved', save: 'Save' },
  fa: { label: 'شماره موبایل', country: 'کد کشور', consent: /موافقم/, confirm: 'تأیید', search: 'جستجوی کشور', saved: 'ذخیره شد', save: 'ذخیره' },
} as const

type Lang = keyof typeof copy

async function openWork(page: Page, lang: Lang, baseURL: string | undefined) {
  await page.context().addCookies([{ name: 'inview-lang', value: lang, url: baseURL || 'http://127.0.0.1:3000' }])
  await page.goto(WORK_PATH)
  await hydrated(page)
}

async function openSheet(page: Page, lang: Lang, baseURL: string | undefined) {
  await openWork(page, lang, baseURL)
  await page.getByRole('button', { name: copy[lang].save, exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

const leadPost = (page: Page) => page.waitForRequest((request) =>
  request.url().includes('/api/v1/pilot') && request.method() === 'POST' && (request.postData() ?? '').includes('"op":"lead"'))

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  await seedCatalogue({
    showTitle: 'Phone show',
    showTitleFa: 'نمایش تلفن',
    works: [{ id: WORK_ID, title: 'Harbour light', artist: 'N. Karimi', price: 1000000, status: 'available', image: '', sample: false }],
  })
})

for (const lang of ['en', 'fa'] as const) {
  test.describe(`${lang} at 390 px in Berlin`, () => {
    test.use({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Berlin', reducedMotion: 'reduce' })

    test('the zone picks Germany and saving a work posts E.164', async ({ page, baseURL }) => {
      await openSheet(page, lang, baseURL)
      const picker = page.getByRole('combobox', { name: copy[lang].country })
      await expect(picker).toHaveValue('DE')
      await expect(page.locator('.phone-country-face')).toContainText('DE')
      await expect(page.locator('.phone-country-face')).toContainText('+49')
      const tel = page.getByRole('textbox', { name: copy[lang].label, exact: true })
      await expect(tel).toHaveAttribute('dir', 'ltr')
      await tel.fill(lang === 'en' ? '0151 12345678' : '۰۱۵۱ ۱۲۳۴۵۶۷۸')
      await page.getByRole('checkbox', { name: copy[lang].consent }).check()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      const posted = leadPost(page)
      const answered = page.waitForResponse((response) => response.request().postData()?.includes('"op":"lead"') ?? false)
      await page.getByRole('button', { name: copy[lang].confirm }).click()
      expect((await posted).postDataJSON().phone).toBe('+4915112345678')
      expect((await answered).status()).toBe(200)
      await expect(page.getByRole('dialog')).toBeHidden()
      await expect(page.getByRole('button', { name: copy[lang].saved })).toBeVisible()
    })

    test('search picks a country and the page remembers it', async ({ page, baseURL }) => {
      await openSheet(page, lang, baseURL)
      await page.getByRole('button', { name: copy[lang].search }).click()
      await page.getByRole('searchbox', { name: copy[lang].search }).fill('Japan')
      await expect(page.getByRole('combobox', { name: copy[lang].country })).toHaveValue('JP')
      await page.keyboard.press('Enter')
      await expect(page.getByRole('textbox', { name: copy[lang].label, exact: true })).toBeFocused()
      await page.reload()
      await page.getByRole('button', { name: copy[lang].save, exact: true }).click()
      await expect(page.getByRole('combobox', { name: copy[lang].country })).toHaveValue('JP')
    })

    test('a landline the server refuses keeps the sheet open with the error', async ({ page, baseURL }) => {
      await openSheet(page, lang, baseURL)
      await page.getByRole('combobox', { name: copy[lang].country }).selectOption('DE')
      await page.getByRole('textbox', { name: copy[lang].label, exact: true }).fill('+49 30 12345678')
      await page.getByRole('checkbox', { name: copy[lang].consent }).check()
      const answered = page.waitForResponse((response) => response.request().postData()?.includes('"op":"lead"') ?? false)
      await page.getByRole('button', { name: copy[lang].confirm }).click()
      expect((await answered).status()).toBe(400)
      await expect(page.locator('#sheet-error')).toBeVisible()
      await expect(page.getByRole('dialog')).toBeVisible()
    })
  })
}

test.describe('in Tehran', () => {
  test.use({ timezoneId: 'Asia/Tehran' })

  test('the zone picks Iran', async ({ page, baseURL }) => {
    await openSheet(page, 'en', baseURL)
    await expect(page.getByRole('combobox', { name: copy.en.country })).toHaveValue('IR')
  })

  test('an old stored number posts as E.164', async ({ page, baseURL }) => {
    await page.addInitScript((version) => {
      localStorage.setItem('inview-demo-v1', JSON.stringify({ phone: '09123334444', consentVersion: version }))
    }, CONSENT_TEXT_VERSION)
    await openWork(page, 'en', baseURL)
    const posted = leadPost(page)
    await page.getByRole('button', { name: copy.en.save, exact: true }).click()
    expect((await posted).postDataJSON().phone).toBe('+989123334444')
  })
})

test.describe('unknown zone', () => {
  test.use({ timezoneId: 'UTC' })

  test('falls back to Iran', async ({ page, baseURL }) => {
    await openSheet(page, 'en', baseURL)
    await expect(page.getByRole('combobox', { name: copy.en.country })).toHaveValue('IR')
  })
})

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { hydrated } from './hydrated'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000'
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
] as const

for (const viewport of viewports) {
  for (const lang of ['fa', 'en'] as const) {
    test(`landing layout and language controls ${viewport.name} ${lang}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.context().addCookies([{ name: 'inview-lang', value: lang, url: baseURL }])
      await page.goto('/', { waitUntil: 'load' })
      await page.evaluate(() => document.fonts.ready)
      await expect(page.locator('.landing')).toBeVisible()
      await expect(page.locator('html')).toHaveAttribute('lang', lang)

      const dimensions = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        controls: Array.from(document.querySelectorAll('.landing a, .landing button'), (element) => {
          const { width, height } = element.getBoundingClientRect()
          return { text: element.textContent, width, height }
        }),
        paragraphs: Array.from(document.querySelectorAll('.landing p'), (element) => ({
          text: element.textContent,
          size: Number.parseFloat(getComputedStyle(element).fontSize),
        })),
      }))
      expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth)
      expect(dimensions.controls.length).toBeGreaterThan(0)
      for (const control of dimensions.controls) {
        expect(control.width, control.text || 'control width').toBeGreaterThanOrEqual(44)
        expect(control.height, control.text || 'control height').toBeGreaterThanOrEqual(44)
      }
      expect(dimensions.paragraphs.length).toBeGreaterThan(0)
      for (const paragraph of dimensions.paragraphs) {
        expect(paragraph.size, paragraph.text || 'paragraph size').toBeGreaterThanOrEqual(15)
      }
      await expect(page.locator('.landing-actions a[href="#contact"]')).toHaveCount(1)
      await expect(page.locator('.landing-pilot')).toHaveCount(1)
      await expect(page.locator('.landing-phone img')).toHaveAttribute('src', '/landing/work.png')

      const next = lang === 'fa' ? 'en' : 'fa'
      await page.locator('.landing-header').getByRole('button', { name: next === 'fa' ? 'فارسی' : 'English', exact: true }).click()
      await expect(page.locator('html')).toHaveAttribute('lang', next)
      await expect(page.locator('.landing-footer').getByRole('button', { name: next === 'fa' ? 'فارسی' : 'English', exact: true })).toHaveAttribute('aria-pressed', 'true')
      await page.locator('.landing-footer').getByRole('button', { name: lang === 'fa' ? 'فارسی' : 'English', exact: true }).click()
      await expect(page.locator('html')).toHaveAttribute('lang', lang)
      await expect(page.locator('.landing-header').getByRole('button', { name: lang === 'fa' ? 'فارسی' : 'English', exact: true })).toHaveAttribute('aria-pressed', 'true')
    })
  }
}

for (const lang of ['fa', 'en'] as const) {
  test(`a gallery sends an inquiry at 390 px in ${lang}`, async ({ page }) => {
    const database = postgres(process.env.DATABASE_URL!, { max: 1 })
    const galleryName = `Inquiry gallery ${lang} ${Date.now()}`
    try {
      await database`delete from rate_limits where bucket like 'inquiry:%'`
      await page.setViewportSize({ width: 390, height: 844 })
      await page.context().addCookies([{ name: 'inview-lang', value: lang, url: baseURL }])
      await page.goto('/#contact', { waitUntil: 'load' })
      await hydrated(page)
      await page.locator('[name="galleryName"]').fill(galleryName)
      await page.locator('[name="contactPerson"]').fill('Contact person')
      await page.locator('[name="contact"]').fill('not a contact')
      await page.locator('[name="message"]').fill('Tell us about the next show')
      await page.locator('[name="consent"]').check()
      await page.locator('.landing-inquiry-form button').click()
      await expect(page.locator('.landing-inquiry-error')).toBeVisible()
      const failing = await new AxeBuilder({ page }).analyze()
      expect(failing.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical')).toEqual([])
      await page.locator('[name="contact"]').fill('09121234567')
      await page.locator('.landing-inquiry-form button').click()
      await expect(page.locator('.landing-inquiry-sent')).toBeVisible()
      await expect(page.locator('.landing-inquiry-form')).toHaveCount(0)
      const sent = await new AxeBuilder({ page }).analyze()
      expect(sent.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical')).toEqual([])
      const width = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }))
      expect(width.document).toBeLessThanOrEqual(width.viewport)
      const rows = await database`select contact, lang, paperclip_issue_id from inquiries where gallery_name = ${galleryName}`
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ contact: '+989121234567', lang, paperclip_issue_id: null })
    } finally {
      await database`delete from rate_limits where bucket like 'inquiry:%'`
      await database.end()
    }
  })
}

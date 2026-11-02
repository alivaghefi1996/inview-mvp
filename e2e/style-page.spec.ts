import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const accessCode = process.env.O_GALLERY_ACCESS_CODE || 'inview'

test.use({ reducedMotion: 'reduce' })

test('an anonymous request to the style page goes to sign-in', async ({ request }) => {
  const response = await request.get('/staff/style', { maxRedirects: 0 })
  expect(response.status()).toBe(302)
  expect(response.headers().location).toBe('/staff/sign-in?next=%2Fstaff%2Fstyle')
  expect(response.headers()['cache-control']).toBe('no-store')
})

for (const width of [390, 1440]) {
  test(`signed-in staff see the style page in both languages at ${width}`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.context().addCookies([{ name: 'inview-lang', value: 'en', url: baseURL || 'http://127.0.0.1:3000' }])
    await page.goto('/staff/sign-in?next=%2Fstaff%2Fstyle')
    const form = page.locator('form').filter({ has: page.getByLabel('Gallery access code', { exact: true }) })
    await form.getByLabel('Gallery address name', { exact: true }).fill('o-gallery')
    await form.getByLabel('Gallery access code', { exact: true }).fill(accessCode)
    await form.getByRole('button', { name: 'Open the editor', exact: true }).click()
    await expect(page).toHaveURL(/\/staff\/style$/)

    for (const [lang, dir, title, next] of [
      ['en', 'ltr', 'Catalogue Wall', 'فا'],
      ['fa', 'rtl', 'دیوار کاتالوگ', 'EN'],
    ]) {
      await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible()
      await expect(page.locator('html')).toHaveAttribute('lang', lang)
      await expect(page.locator('html')).toHaveAttribute('dir', dir)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(0)
      const axe = await new AxeBuilder({ page }).analyze()
      expect(axe.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical').map((item) => item.id)).toEqual([])
      await page.getByRole('button', { name: next, exact: true }).click()
    }
  })
}

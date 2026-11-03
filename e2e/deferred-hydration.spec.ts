import { expect, test } from '@playwright/test'
import { seedCatalogue, type SeedRecord } from './seed-catalogue'

const catalogue: SeedRecord = {
  showTitle: 'Late Scripts',
  showTitleFa: 'اسکریپت‌های دیرهنگام',
  works: [
    { id: 'defer-work-01', title: 'Harbour light', artist: 'Sara Emami', status: 'available', price: 1250000 },
    { id: 'defer-work-02', title: 'Salt road', artist: 'Sara Emami', status: 'reserved', price: 900000 },
  ],
}

const SCRIPT_ASSET = /\/assets\/.*\.js(\?|$)/

test.describe.configure({ mode: 'serial' })

test.describe('deferred hydration', () => {
  test.beforeAll(async () => {
    await seedCatalogue(catalogue)
  })

  // These two strings are the contract with React Router's own markup. An upgrade that renames
  // `rel="modulepreload"` or `type="module"` fails here instead of quietly shipping the scripts
  // before the paint again.
  test('a public document leaves its module scripts inert', async ({ request }) => {
    for (const path of ['/g/o-gallery', '/g/o-gallery/works', '/g/o-gallery/prices', '/g/o-gallery/about', '/']) {
      const body = await (await request.get(path)).text()
      expect(body, path).not.toContain('rel="modulepreload"')
      expect(body, path).not.toContain('<script type="module"')
      expect(body, path).toContain('rel="inview-deferred-modulepreload"')
      expect(body, path).toContain('<script type="inview/deferred-module"')
    }
  })

  test('the personal and staff pages still hydrate while the document parses', async ({ request }) => {
    for (const path of ['/me', '/staff/sign-in']) {
      const body = await (await request.get(path)).text()
      expect(body, path).toContain('rel="modulepreload"')
      expect(body, path).toContain('<script type="module"')
    }
  })

  test('the works page asks for no script before the load event', async ({ page }) => {
    const before: string[] = []
    let loaded = false
    page.on('request', (request) => {
      if (!loaded && SCRIPT_ASSET.test(request.url())) before.push(request.url())
    })
    await page.goto('/g/o-gallery/works', { waitUntil: 'load' })
    loaded = true
    expect(before).toEqual([])

    await expect(page.locator('html')).toHaveAttribute('data-hydrated', '')
    await expect(page.locator('.o-wall .card')).toHaveCount(2)
  })

  test('a tap that lands before hydration is not lost', async ({ page }) => {
    await page.goto('/g/o-gallery/works', { waitUntil: 'domcontentloaded' })
    const reserved = page.locator('.chips button', { hasText: /Reserved|رزرو/ })
    await reserved.click({ force: true })
    await expect(page.locator('html')).toHaveAttribute('data-hydrated', '')
    await expect(reserved).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.o-wall .card')).toHaveCount(1)
  })
})

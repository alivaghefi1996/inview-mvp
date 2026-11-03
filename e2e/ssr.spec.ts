import { expect, test } from '@playwright/test'
import { seedCatalogue } from './seed-catalogue'

const work = {
  id: 'ssrwork01',
  title: 'Harbour light',
  artist: 'N. Karimi',
  medium: 'Oil on canvas',
  size: '40 × 50 cm',
  year: '2024',
  price: 1_000_000,
  status: 'available' as const,
  image: '',
  sample: false,
}

const catalogue = {
  showTitle: 'Server Rendered Show',
  showTitleFa: 'نمایش رندر سروری',
  works: [work],
}

test.describe.configure({ mode: 'serial' })

test.describe('server rendering', () => {
  test.beforeAll(async () => {
    await seedCatalogue(catalogue)
  })

  test('the works page carries the catalogue in the server HTML', async ({ request }) => {
    const response = await request.get('/g/o-gallery/works')
    expect(response.status()).toBe(200)
    const body = await response.text()
    expect(body).toContain(work.title)
    expect(body).toContain(work.artist)
    expect(body).toContain(catalogue.showTitleFa)
    expect(body).not.toMatch(/Unexpected Server Error/i)
  })

  test('the landing, prices and about pages carry the show in the server HTML', async ({ request }) => {
    for (const path of ['/g/o-gallery', '/g/o-gallery/prices', '/site/o-gallery']) {
      const response = await request.get(path)
      expect(response.status(), path).toBe(200)
      expect(await response.text(), path).toContain(catalogue.showTitleFa)
    }
  })

  test('the work page carries the work in the server HTML', async ({ request }) => {
    const response = await request.get(`/g/o-gallery/works/${work.id}`)
    expect(response.status()).toBe(200)
    expect(await response.text()).toContain(work.title)
  })

  test('O Gallery renders Persian, and the language cookie switches it', async ({ request }) => {
    const persian = await request.get('/g/o-gallery')
    expect(await persian.text()).toMatch(/<html[^>]*lang="fa"[^>]*dir="rtl"/)

    const english = await request.get('/g/o-gallery', { headers: { cookie: 'inview-lang=en' } })
    expect(await english.text()).toMatch(/<html[^>]*lang="en"[^>]*dir="ltr"/)
  })

  test('the Rooz demo website stays English under the Persian cookie', async ({ request }) => {
    const response = await request.get('/site/rooz-gallery', { headers: { cookie: 'inview-lang=fa' } })
    expect(response.status()).toBe(200)
    const body = await response.text()
    expect(body).toMatch(/<html[^>]*lang="en"[^>]*dir="ltr"/)
    expect(body).toContain('<title>Rooz Gallery · Website</title>')
    expect(body).toMatch(/<meta[^>]*property="og:locale"[^>]*content="en_US"/)
    expect(body).not.toMatch(/lang="fa"|dir="rtl"/)
  })

  test('public pages send the ADR D7 cache header', async ({ request }) => {
    const response = await request.get('/g/o-gallery/works')
    expect(response.headers()['cache-control']).toBe(
      'public, max-age=0, s-maxage=60, stale-while-revalidate=600',
    )
    expect(response.headers()['vary']).toContain('Cookie')
  })

  test('the root path renders Inview in Persian without a redirect', async ({ request }) => {
    const response = await request.get('/', { maxRedirects: 0 })
    expect(response.status()).toBe(200)
    expect(response.headers()['location']).toBeUndefined()
    const body = await response.text()
    expect(body).toMatch(/<html[^>]*lang="fa"[^>]*dir="rtl"/)
    expect(body).toContain('آثار گالری شما، در\u00a0دست بازدیدکننده.')
    expect(body).toContain('href="/g/sample"')
    const english = await request.get('/', { headers: { cookie: 'inview-lang=en' } })
    expect(await english.text()).toMatch(/<html[^>]*lang="en"[^>]*dir="ltr"/)
    expect(await english.text()).toContain('Your gallery, in your visitor')
  })

  test('unknown slugs and unknown work ids answer 404', async ({ request }) => {
    const slug = await request.get('/g/unknown-slug')
    expect(slug.status()).toBe(404)
    expect(await slug.text()).toContain('صفحه پیدا نشد')

    const english = await request.get('/g/unknown-slug', { headers: { cookie: 'inview-lang=en' } })
    expect(english.status()).toBe(404)
    expect(await english.text()).toContain('Page not found')

    const site = await request.get('/site/unknown')
    expect(site.status()).toBe(404)

    const missingWork = await request.get('/g/o-gallery/works/no-such-work')
    expect(missingWork.status()).toBe(404)
    expect(await missingWork.text()).toContain('صفحه پیدا نشد')
  })

  test('every 404 carries the not-found title and noindex', async ({ request }) => {
    const titles = { en: 'Page not found · Inview', fa: 'صفحه پیدا نشد · اینویو' }
    for (const path of ['/no-such-page', '/g/unknown-slug', '/g/o-gallery/works/no-such-work']) {
      for (const [lang, title] of Object.entries(titles)) {
        const response = await request.get(path, { headers: { cookie: `inview-lang=${lang}` } })
        expect(response.status(), `${path} ${lang}`).toBe(404)
        const body = await response.text()
        expect(body, `${path} ${lang}`).toContain(`<title>${title}</title>`)
        expect(body, `${path} ${lang}`).toMatch(/<meta name="robots" content="noindex"\/?>/)
      }
    }
  })

  test('the landing language switch updates the document and persists after reload', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await page.locator('.landing-header').getByRole('button', { name: 'English', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your gallery, in your visitor’s hands.')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.locator('.landing-header').getByRole('button', { name: 'فارسی', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  })

  test('the first page load does not ask the API for the record again', async ({ page }) => {
    const pilotReads: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'GET' && request.url().includes('/api/v1/pilot')) {
        pilotReads.push(request.url())
      }
    })
    await page.goto('/g/o-gallery/works', { waitUntil: 'load' })
    await expect(page.getByText(work.title).first()).toBeVisible()
    expect(pilotReads).toEqual([])
  })
})

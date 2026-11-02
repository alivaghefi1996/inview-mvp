import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { EMPTY_CATALOGUE, seedCatalogue, type SeedRecord } from './seed-catalogue'

const accessCode = process.env.O_GALLERY_ACCESS_CODE || 'inview'

const catalogue = (
  JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures/o-gallery-catalogue.json'), 'utf8'),
  ) as { record: SeedRecord }
).record

const publicRoutes = [
  '/',
  '/g/o-gallery',
  '/g/o-gallery/works',
  '/g/o-gallery/works/vis-work-01',
  '/g/o-gallery/prices',
  '/g/o-gallery/about',
  '/g/rooz-gallery',
  '/g/rooz-gallery/works',
  '/g/rooz-gallery/works/fateh-face',
  '/g/rooz-gallery/prices',
  '/g/rooz-gallery/about',
  '/site/o-gallery',
  '/site/rooz-gallery',
  '/me',
  '/privacy',
  '/no-such-page',
  '/g/o-gallery/works/no-such-work',
  '/dashboard',
  '/dashboard/artworks',
  '/dashboard/audience',
  '/dashboard/website',
  '/dashboard/plans',
  '/staff/sign-in',
]

const emptyCatalogueRoutes = [
  '/g/o-gallery',
  '/g/o-gallery/works',
  '/g/o-gallery/prices',
  '/g/o-gallery/about',
  '/site/o-gallery',
]

const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desk', width: 1440, height: 900 },
] as const

async function blocking(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined)))
  })
  const results = await new AxeBuilder({ page }).analyze()
  return results.violations
    .filter((item) => item.impact === 'serious' || item.impact === 'critical')
    .map((item) => `${item.impact}:${item.id}:${item.nodes.map((node) => node.target.join(' ')).slice(0, 3).join('|')}`)
}

async function routeFailures(page: Page, paths: string[]) {
  const failures: string[] = []
  for (const path of paths) {
    await page.goto(path)
    if (!(await page.title()).trim()) failures.push(`${path}: no title`)
    const headings = await page.locator('h1').count()
    if (headings !== 1) failures.push(`${path}: ${headings} h1`)
    const found = await blocking(page)
    if (found.length) failures.push(`${path}: ${found.join(', ')}`)
  }
  return failures
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  await seedCatalogue(catalogue)
})

for (const viewport of viewports) {
  test.describe(`axe ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: 'reduce' })

    for (const lang of ['fa', 'en'] as const) {
      test(`every route has no serious or critical violation in ${lang}`, async ({ page, baseURL }) => {
        await page.context().addCookies([{ name: 'inview-lang', value: lang, url: baseURL || 'http://127.0.0.1:3000' }])
        expect(await routeFailures(page, publicRoutes)).toEqual([])
      })
    }

    test('the signed-in editor has no serious or critical violation', async ({ page, baseURL }) => {
      await page.context().addCookies([{ name: 'inview-lang', value: 'en', url: baseURL || 'http://127.0.0.1:3000' }])
      await page.goto('/staff/sign-in')
      const form = page.locator('form').filter({ has: page.getByLabel('Gallery access code', { exact: true }) })
      await form.getByLabel('Gallery address name', { exact: true }).fill('o-gallery')
      await form.getByLabel('Gallery access code', { exact: true }).fill(accessCode)
      await form.getByRole('button', { name: 'Open the editor', exact: true }).click()
      await expect(page).toHaveURL(/\/staff\/o-gallery$/)
      expect(await blocking(page)).toEqual([])
    })
  })
}

test.describe('axe with an empty catalogue', () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })

  test.beforeAll(async () => {
    await seedCatalogue(EMPTY_CATALOGUE)
  })

  test.afterAll(async () => {
    await seedCatalogue(catalogue)
  })

  for (const lang of ['fa', 'en'] as const) {
    test(`a show with no work keeps one h1 on each public route in ${lang}`, async ({ page, baseURL }) => {
      await page.context().addCookies([{ name: 'inview-lang', value: lang, url: baseURL || 'http://127.0.0.1:3000' }])
      expect(await routeFailures(page, emptyCatalogueRoutes)).toEqual([])
    })
  }
})

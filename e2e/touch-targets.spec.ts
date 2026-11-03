import { expect, test } from '@playwright/test'

// A link sized by its text can fall under the 24px target minimum: the Persian nav
// label is 19px wide and the Instagram handle 21px tall before the fix for HAD-145.
const MIN = 24

// These pages come from `app/data/gallery.ts`, so this spec needs no seed.
const routes = [
  '/g/rooz-gallery',
  '/g/rooz-gallery/works',
  '/g/rooz-gallery/prices',
  '/g/rooz-gallery/about',
  '/site/rooz-gallery',
  '/me',
]

for (const width of [390, 1440]) {
  test.describe(`visitor targets at ${width}px`, () => {
    test.use({ viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: 'reduce' })

    for (const lang of ['fa', 'en'] as const) {
      test(`every target is at least ${MIN}px in ${lang}`, async ({ page, baseURL }) => {
        await page.context().addCookies([{ name: 'inview-lang', value: lang, url: baseURL || 'http://127.0.0.1:3000' }])

        for (const route of routes) {
          await page.goto(route)
          await page.evaluate(() => document.fonts.ready)

          const found = await page.evaluate((min) => {
            const small: string[] = []
            let measured = 0
            for (const el of document.querySelectorAll('a[href], button:not([disabled]), [role="button"]')) {
              if (getComputedStyle(el).visibility === 'hidden') continue
              const box = el.getBoundingClientRect()
              if (box.width === 0 && box.height === 0) continue
              measured += 1
              if (box.width >= min && box.height >= min) continue
              const label = (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40)
              small.push(`"${label}" is ${Math.round(box.width)} by ${Math.round(box.height)}px`)
            }
            return { small, measured }
          }, MIN)

          const where = `${route} in ${lang} at ${width}px`
          expect(found.measured, `${where} has no target to measure`).toBeGreaterThan(4)
          expect(found.small, where).toEqual([])
        }
      })
    }
  })
}

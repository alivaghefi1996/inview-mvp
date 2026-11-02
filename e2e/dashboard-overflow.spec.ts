import { expect, test } from '@playwright/test'

// The dashboard renders the static demo report, so this spec seeds nothing.
const paths = [
  '/dashboard',
  '/dashboard/artworks',
  '/dashboard/audience',
  '/dashboard/website',
  '/dashboard/plans',
]

const phone = { width: 390, height: 844 }

for (const path of paths) {
  test(`${path} has no horizontal overflow at ${phone.width}px`, async ({ page }) => {
    await page.setViewportSize(phone)
    await page.goto(path, { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)

    // A wide table inside .scroll-x scrolls on its own, so only the document must fit.
    const size = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(size.scrollWidth, `${path} overflows by ${size.scrollWidth - size.clientWidth}px`).toBe(size.clientWidth)
  })
}

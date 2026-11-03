import AxeBuilder from '@axe-core/playwright'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { langs, routes, viewports } from './pages'

const reportDir = 'visual-qa-report'
const baseURL = process.env.QA_BASE_URL || 'https://inview.moshes.io'
const updating = process.env.QA_UPDATE === '1'
const settlePasses = 6
const imageTimeout = 20_000

mkdirSync(`${reportDir}/pages`, { recursive: true })
mkdirSync(`${reportDir}/screenshots`, { recursive: true })

async function scrollThroughPage(page: Page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.8)
    const frame = () => new Promise((done) => requestAnimationFrame(() => done(null)))
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await frame()
    }
    window.scrollTo(0, document.documentElement.scrollHeight)
    await frame()
    window.scrollTo(0, 0)
    await frame()
  })
  await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete), null, {
    timeout: imageTimeout,
  })
  return page.evaluate(() => document.images.length)
}

// A work image stays behind an IntersectionObserver until a scroll brings it
// near the viewport, and each <img> that appears can hold a later image back.
// A shot taken before the count stops growing has blank artworks.
async function loadDeferredImages(page: Page) {
  let count = -1
  for (let pass = 0; pass < settlePasses; pass++) {
    let seen: number
    try {
      seen = await scrollThroughPage(page)
    } catch {
      return { imageCount: count, settled: false }
    }
    if (seen === count) return { imageCount: seen, settled: true }
    count = seen
  }
  return { imageCount: count, settled: false }
}

for (const vp of viewports) {
  for (const lang of langs) {
    for (const route of routes) {
      const id = `${route.name}-${vp.name}-${lang}`
      test(id, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await page.context().addCookies([{ name: 'inview-lang', value: lang, url: baseURL }])
        const errors: string[] = []
        page.on('pageerror', (err) => errors.push(err.message.slice(0, 200)))
        const response = await page.goto(route.path, { waitUntil: 'networkidle' })
        await page.evaluate(() => document.fonts.ready)
        await page.waitForTimeout(600)

        const { imageCount, settled } = await loadDeferredImages(page)
        const blankImages = await page.evaluate(() =>
          Array.from(document.images)
            .filter((img) => img.naturalWidth === 0)
            .map((img) => img.currentSrc || img.src),
        )

        const status = response?.status() ?? 0
        const expected = route.name === 'not-found' ? 404 : 200
        const entry: Record<string, unknown> = {
          id,
          path: route.path,
          viewport: vp.name,
          lang,
          httpStatus: status,
          expectedStatus: expected,
          httpOk: status === expected,
          pageErrors: errors,
          imageCount,
          imagesSettled: settled,
          blankImages,
        }

        await page.screenshot({
          path: `${reportDir}/screenshots/${id}.png`,
          fullPage: true,
          animations: 'disabled',
        })

        const axe = await new AxeBuilder({ page }).analyze()
        entry.axe = axe.violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length }))

        const hasBaseline = existsSync(`visual-qa/baselines/${id}.png`)
        entry.visual = hasBaseline || updating ? 'compared' : 'no-baseline'
        writeFileSync(`${reportDir}/pages/${id}.json`, JSON.stringify(entry, null, 2))

        expect.soft(status, `${route.path} status`).toBe(expected)
        if (hasBaseline || updating) {
          await expect.soft(page).toHaveScreenshot(`${id}.png`, {
            animations: 'disabled',
            fullPage: true,
            maxDiffPixelRatio: 0.02,
          })
        }
      })
    }
  }
}

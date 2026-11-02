import { expect, test } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000'

// The visual baselines cover 390px only, and the tab labels are sized by their text,
// so a longer label can push the fifth tab off the row on the narrowest phone.
const widths = [320, 390]
const langs = ['en', 'fa'] as const
const TOUCH = 44

interface Tab {
  text: string
  top: number
  right: number
  width: number
  height: number
  labelBox: number
  labelText: number
}

for (const lang of langs) {
  for (const width of widths) {
    test(`the five visitor tabs hold one row at ${width}px in ${lang}`, async ({ page }) => {
      await page.context().addCookies([{ name: 'inview-lang', value: lang, url: baseURL }])
      await page.setViewportSize({ width, height: 844 })
      await page.goto('/g/o-gallery/works', { waitUntil: 'load' })
      await page.evaluate(() => document.fonts.ready)

      const tabs: Tab[] = await page.evaluate(() => {
        const nav = document.querySelector('.v-tabs')
        if (!nav) throw new Error('the visitor tab bar is missing')
        return [...nav.querySelectorAll('a')].map((link) => {
          const box = link.getBoundingClientRect()
          const label = link.querySelector('span')
          const labelBox = label ? label.getBoundingClientRect().width : 0
          return {
            text: label?.textContent ?? '',
            top: Math.round(box.top),
            right: box.right,
            width: box.width,
            height: box.height,
            labelBox: Math.ceil(labelBox),
            labelText: label?.scrollWidth ?? 0,
          }
        })
      })

      expect(tabs).toHaveLength(5)
      const rows = [...new Set(tabs.map((tab) => tab.top))]
      expect(rows, `tabs sit on rows ${rows.join(', ')}: ${tabs.map((tab) => `${tab.text}@${tab.top}`).join(' ')}`).toHaveLength(1)
      await expect(page.locator('.v-tabs a.active')).toHaveCount(1)

      for (const tab of tabs) {
        expect(tab.right, `"${tab.text}" ends at ${Math.round(tab.right)}px`).toBeLessThanOrEqual(width + 0.5)
        expect(tab.width, `"${tab.text}" is ${Math.round(tab.width)}px wide`).toBeGreaterThanOrEqual(TOUCH)
        expect(tab.height, `"${tab.text}" is ${Math.round(tab.height)}px tall`).toBeGreaterThanOrEqual(TOUCH)
        expect(tab.labelText, `"${tab.text}" is cut off`).toBeLessThanOrEqual(tab.labelBox)
      }
    })
  }
}

import { expect, test } from '@playwright/test'

for (const width of [390, 1440]) {
  for (const [lang, mode] of [['fa', 'account'], ['en', 'account'], ['fa', 'code'], ['en', 'code']] as const) {
    test(`staff sign-in ${mode} labels sit above equal-width inputs at ${width} in ${lang}`, async ({ page, baseURL }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.context().addCookies([{ name: 'inview-lang', value: lang, url: baseURL || 'http://127.0.0.1:3000' }])
      await page.goto(`/staff/sign-in${mode === 'code' ? '?mode=code' : ''}`)
      const fields = await page.locator('.gate-field').evaluateAll((nodes) => nodes.map((node) => {
        const label = node.querySelector('label')!
        const input = node.querySelector('input')!
        return {
          linked: label.htmlFor === input.id && input.id !== '',
          labelBottom: label.getBoundingClientRect().bottom,
          inputTop: input.getBoundingClientRect().top,
          inputWidth: input.getBoundingClientRect().width,
        }
      }))
      expect(fields).toHaveLength(2)
      for (const field of fields) {
        expect(field.linked).toBe(true)
        expect(field.labelBottom).toBeLessThanOrEqual(field.inputTop)
        expect(Math.abs(field.inputWidth - fields[0].inputWidth)).toBeLessThan(1)
      }
    })
  }
}

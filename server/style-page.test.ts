import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import {
  colourTokens,
  contrastPairs,
  contrastRatio,
  hexFor,
  radiusTokens,
  spaceTokens,
  TEXT_MINIMUM,
  UI_MINIMUM,
} from '../app/lib/design-tokens'
import { styleDictionaries } from '../app/lib/i18n-style'
import StyleGuide from '../app/pages/gallery/StyleGuide'
import { renderStaff } from './test-render'

const css = readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8')

function tokenValue(name: string) {
  return css.match(new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm'))?.[1].trim()
}

test('the style page lists the token values from app/styles.css', () => {
  for (const token of colourTokens) assert.equal(tokenValue(token.name)?.toUpperCase(), token.hex.toUpperCase(), token.name)
  for (const token of [...spaceTokens, ...radiusTokens]) assert.equal(tokenValue(token.name), `${token.px}px`, token.name)
})

test('each listed colour pair meets its contrast minimum', () => {
  for (const pair of contrastPairs) {
    const ratio = contrastRatio(hexFor(pair.foreground), hexFor(pair.background))
    assert.ok(ratio >= (pair.kind === 'text' ? TEXT_MINIMUM : UI_MINIMUM), `${pair.foreground} on ${pair.background}: ${ratio.toFixed(2)}`)
  }
})

test('the English and Persian copy has the same shape', () => {
  const shape = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(shape)
    if (value && typeof value === 'object') return Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, shape(item)])
    return typeof value
  }
  assert.deepEqual(shape(styleDictionaries.fa), shape(styleDictionaries.en))
})

for (const lang of ['en', 'fa'] as const) {
  test(`the style page renders each part in ${lang}`, () => {
    const html = renderStaff(createElement(StyleGuide), lang, '/staff/style')
    assert.match(html, new RegExp(`dir="${lang === 'fa' ? 'rtl' : 'ltr'}"`))
    assert.ok(html.includes(styleDictionaries[lang].heroTitle))
    for (const part of ['btn-primary', 'chips', 's-reserved', 'pill warn', 'wall-label', 'price-row', 'class="sheet"', 'sheet-form', 'empty-state', 'skeleton', 'staff-totals', 'staff-table', 'bar-track']) {
      assert.ok(html.includes(part), part)
    }
  })
}

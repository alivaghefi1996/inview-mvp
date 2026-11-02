export const colourTokens = [
  { name: '--ink', hex: '#121714' },
  { name: '--ink-soft', hex: '#2A2F2C' },
  { name: '--paper', hex: '#F4F0E8' },
  { name: '--surface', hex: '#FFFCF7' },
  { name: '--field', hex: '#EBE6DC' },
  { name: '--line', hex: '#D2CBBE' },
  { name: '--line-strong', hex: '#B8B0A0' },
  { name: '--muted', hex: '#5A564E' },
  { name: '--pine', hex: '#17332E' },
  { name: '--pine-hover', hex: '#0F2420' },
  { name: '--pine-tint', hex: '#E4EDE9' },
  { name: '--ochre', hex: '#A85A32' },
  { name: '--ochre-tint', hex: '#F3E4D8' },
  { name: '--ochre-ink', hex: '#7A4528' },
  { name: '--good', hex: '#1B6B45' },
  { name: '--warn', hex: '#A35731' },
  { name: '--sold', hex: '#8B2E22' },
  { name: '--danger', hex: '#9B2C1F' },
] as const

export type ColourToken = (typeof colourTokens)[number]['name']
export type ContrastKind = 'text' | 'ui'

export const TEXT_MINIMUM = 4.5
export const UI_MINIMUM = 3

export const contrastPairs: { foreground: ColourToken | 'white'; background: ColourToken; kind: ContrastKind }[] = [
  { foreground: '--ink', background: '--paper', kind: 'text' },
  { foreground: '--ink', background: '--surface', kind: 'text' },
  { foreground: '--ink-soft', background: '--surface', kind: 'text' },
  { foreground: '--muted', background: '--paper', kind: 'text' },
  { foreground: '--muted', background: '--field', kind: 'text' },
  { foreground: 'white', background: '--pine', kind: 'text' },
  { foreground: '--paper', background: '--pine', kind: 'text' },
  { foreground: '--pine', background: '--pine-tint', kind: 'text' },
  { foreground: '--ochre-ink', background: '--paper', kind: 'text' },
  { foreground: '--ochre-ink', background: '--ochre-tint', kind: 'text' },
  { foreground: '--good', background: '--surface', kind: 'text' },
  { foreground: '--warn', background: '--paper', kind: 'text' },
  { foreground: '--sold', background: '--surface', kind: 'text' },
  { foreground: '--danger', background: '--paper', kind: 'text' },
  { foreground: '--ochre', background: '--paper', kind: 'ui' },
  { foreground: '--pine', background: '--field', kind: 'ui' },
  { foreground: '--ochre', background: '--field', kind: 'ui' },
]

export const spaceTokens = [
  { name: '--space-1', px: 4 },
  { name: '--space-2', px: 8 },
  { name: '--space-3', px: 12 },
  { name: '--space-4', px: 16 },
  { name: '--space-5', px: 24 },
  { name: '--space-6', px: 32 },
  { name: '--space-7', px: 48 },
  { name: '--space-8', px: 64 },
] as const

export const radiusTokens = [
  { name: '--radius-hair', px: 2 },
  { name: '--radius', px: 6 },
  { name: '--radius-panel', px: 10 },
] as const

function channel(value: number): number {
  const part = value / 255
  return part <= 0.04045 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const [red, green, blue] = [1, 3, 5].map((start) => channel(parseInt(hex.slice(start, start + 2), 16)))
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

export function hexFor(token: ColourToken | 'white'): string {
  if (token === 'white') return '#FFFFFF'
  return colourTokens.find((item) => item.name === token)!.hex
}

export function contrastRatio(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (light + 0.05) / (dark + 0.05)
}

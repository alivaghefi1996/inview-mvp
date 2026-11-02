export type PhoneCountry = readonly [iso: string, dial: string, mobileLengths: readonly number[], trunkPrefix: string]

export type CountryOption = { iso: string; dial: string; name: string; nameEn: string }

export const FALLBACK_COUNTRY: PhoneCountry = ['IR', '98', [10], '0']
export const PHONE_COUNTRY_KEY = 'inview-phone-country'
export const INVALID_PHONE_CODE = 'invalid_phone'

const E164 = /^\+[1-9]\d{6,14}$/
const LEGACY_IRAN_MOBILE = /^09\d{9}$/
const IRAN_MOBILE = /^\+989\d{9}$/
const MAX_E164_DIGITS = 15
const MIN_NATIONAL_DIGITS = 6

export function latinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
}

export function isE164(value: string): boolean {
  return E164.test(value)
}

export function isIranMobile(value: string): boolean {
  return IRAN_MOBILE.test(value)
}

export function canonicalPhone(value: string): string {
  return LEGACY_IRAN_MOBILE.test(value) ? `+98${value.slice(1)}` : value
}

export function legacyPhone(value: string): string | null {
  return isIranMobile(value) ? `0${value.slice(3)}` : null
}

export function toE164(input: string, country: PhoneCountry = FALLBACK_COUNTRY): string | null {
  const compact = latinDigits(input).replace(/[\s\-().‎‏‪-‮]/g, '')
  if (/^(\+|00)/.test(compact)) {
    const international = `+${compact.replace(/^(\+|00)/, '')}`
    return isE164(international) ? international : null
  }
  if (!/^\d+$/.test(compact)) return null
  const [, dial, lengths, trunk] = country
  const fits = (digits: number) => lengths.length > 0
    ? lengths.includes(digits)
    : digits >= MIN_NATIONAL_DIGITS && digits + dial.length <= MAX_E164_DIGITS
  let national: string
  if (compact.startsWith(dial) && fits(compact.length - dial.length)) national = compact.slice(dial.length)
  else if (trunk && compact.startsWith(trunk) && fits(compact.length - trunk.length)) national = compact.slice(trunk.length)
  else if (fits(compact.length)) national = compact
  else return null
  const e164 = `+${dial}${national}`
  return isE164(e164) ? e164 : null
}

export function flagEmoji(iso: string): string {
  return String.fromCodePoint(...Array.from(iso, (letter) => 0x1f1e6 + letter.charCodeAt(0) - 65))
}

export function pickCountry(
  countries: readonly PhoneCountry[],
  zones: Readonly<Record<string, string>>,
  stored: string | null,
  zone: string | undefined,
): PhoneCountry {
  const byIso = (iso: string | null | undefined) => (iso ? countries.find((country) => country[0] === iso) : undefined)
  return byIso(stored) ?? byIso(zone ? zones[zone] : null) ?? byIso(FALLBACK_COUNTRY[0]) ?? FALLBACK_COUNTRY
}

export function countryForNumber(
  input: string,
  countries: readonly PhoneCountry[],
  current: PhoneCountry,
): PhoneCountry {
  const compact = latinDigits(input).replace(/[^\d+]/g, '')
  if (!/^(\+|00)/.test(compact)) return current
  const digits = compact.replace(/^(\+|00)/, '')
  if (digits.startsWith(current[1])) return current
  let best = current
  let length = 0
  for (const country of countries) {
    if (country[1].length > length && digits.startsWith(country[1])) {
      best = country
      length = country[1].length
    }
  }
  return best
}

function foldSearch(value: string): string {
  return latinDigits(value).toLocaleLowerCase('en').replace(/ي/g, 'ی').replace(/ك/g, 'ک').trim()
}

function searchRank(option: CountryOption, query: string): number {
  const digits = query.replace(/^\+/, '')
  if (option.iso.toLowerCase() === query || option.dial === digits) return 0
  const names = [foldSearch(option.name), foldSearch(option.nameEn)]
  if (names.some((name) => name.startsWith(query))) return 1
  if (names.some((name) => name.includes(query))) return 2
  if (digits && /^\d+$/.test(digits) && option.dial.startsWith(digits)) return 3
  return Number.POSITIVE_INFINITY
}

export function searchCountries(options: readonly CountryOption[], rawQuery: string): CountryOption[] {
  const query = foldSearch(rawQuery)
  if (!query) return [...options]
  return options
    .map((option) => ({ option, rank: searchRank(option, query) }))
    .filter((entry) => entry.rank !== Number.POSITIVE_INFINITY)
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.option)
}

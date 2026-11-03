import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { getAllTimezones } from 'countries-and-timezones'
import { Metadata } from 'libphonenumber-js/core'

const require = createRequire(import.meta.url)
const metadata = require('libphonenumber-js/metadata.mobile.json')

export const PHONE_DATA_PATH = fileURLToPath(new URL('../app/lib/phone-data.generated.ts', import.meta.url))

function phoneCountries() {
  const plans = new Metadata(metadata)
  const countries = []
  for (const [dial, isos] of Object.entries(metadata.country_calling_codes)) {
    for (const iso of isos) {
      const { numberingPlan } = plans.selectNumberingPlan(iso)
      const trunk = numberingPlan.nationalPrefix()
      const lengths = numberingPlan.type('MOBILE')?.possibleLengths() ?? numberingPlan.possibleLengths() ?? []
      countries.push([iso, dial, lengths, typeof trunk === 'string' ? trunk : ''])
    }
  }
  return countries
}

function zoneCountries(known) {
  const zones = {}
  const all = getAllTimezones({ deprecated: true })
  for (const name of Object.keys(all).sort()) {
    const country = all[name].countries.find((iso) => known.has(iso))
    if (country) zones[name] = country
  }
  return zones
}

export function renderPhoneData() {
  const countries = phoneCountries()
  const zones = zoneCountries(new Set(countries.map(([iso]) => iso)))
  return [
    "import type { PhoneCountry } from './phone'",
    '',
    `export const PHONE_COUNTRIES: readonly PhoneCountry[] = ${JSON.stringify(countries)}`,
    '',
    `export const ZONE_COUNTRIES: Readonly<Record<string, string>> = ${JSON.stringify(zones)}`,
    '',
  ].join('\n')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) writeFileSync(PHONE_DATA_PATH, renderPhoneData())

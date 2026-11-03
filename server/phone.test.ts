import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  FALLBACK_COUNTRY,
  canonicalPhone,
  countryForNumber,
  flagEmoji,
  pickCountry,
  searchCountries,
  toE164,
  type PhoneCountry,
} from '../app/lib/phone'
import { PHONE_COUNTRIES, ZONE_COUNTRIES } from '../app/lib/phone-data.generated'
import { PHONE_DATA_PATH, renderPhoneData } from '../scripts/generate-phone-data.mjs'
import { maskPhone, mobilePhone, normalizePhone, phoneLookupForms, validPhone } from './phone'

const country = (iso: string): PhoneCountry => PHONE_COUNTRIES.find((item) => item[0] === iso)!

test('the generated phone data matches its packages', () => {
  assert.equal(readFileSync(PHONE_DATA_PATH, 'utf8'), renderPhoneData(), 'Run npm run gen:phone-data.')
})

test('the fallback country is the generated Iran entry', () => {
  assert.deepEqual(country(FALLBACK_COUNTRY[0]), FALLBACK_COUNTRY)
})

test('time zones pick a country, and an unknown zone falls back to Iran', () => {
  const pick = (zone: string | undefined, stored: string | null = null) => pickCountry(PHONE_COUNTRIES, ZONE_COUNTRIES, stored, zone)[0]
  assert.equal(pick('Asia/Tehran'), 'IR')
  assert.equal(pick('Europe/Berlin'), 'DE')
  assert.equal(pick('America/New_York'), 'US')
  assert.equal(pick('Asia/Calcutta'), 'IN')
  assert.equal(pick('Asia/Kolkata'), 'IN')
  assert.equal(pick('UTC'), 'IR')
  assert.equal(pick('Mars/Olympus'), 'IR')
  assert.equal(pick(undefined), 'IR')
  assert.equal(pick('Asia/Tehran', 'DE'), 'DE')
  assert.equal(pick('Asia/Tehran', 'ZZ'), 'IR')
})

test('local numbers resolve through the chosen country in every digit form', () => {
  for (const input of ['09123456789', '۰۹۱۲۳۴۵۶۷۸۹', '٠٩١٢٣٤٥٦٧٨٩', '0912 345 6789', '9123456789', '989123456789', '+۹۸۹۱۲۳۴۵۶۷۸۹', '۰۰۹۸۹۱۲۳۴۵۶۷۸۹']) {
    assert.equal(toE164(input), '+989123456789', input)
  }
  assert.equal(toE164('0151 12345678', country('DE')), '+4915112345678')
  assert.equal(toE164('415 555 2671', country('US')), '+14155552671')
  assert.equal(toE164('07911 123456', country('GB')), '+447911123456')
  assert.equal(toE164('0912345', country('IR')), null)
  assert.equal(toE164('abc'), null)
  assert.equal(toE164(''), null)
})

test('a typed dial code moves the picker, and a shared code keeps the current country', () => {
  assert.equal(countryForNumber('+49151', PHONE_COUNTRIES, FALLBACK_COUNTRY)[0], 'DE')
  assert.equal(countryForNumber('+1415', PHONE_COUNTRIES, FALLBACK_COUNTRY)[0], 'US')
  assert.equal(countryForNumber('+1415', PHONE_COUNTRIES, country('CA'))[0], 'CA')
  assert.equal(countryForNumber('0912', PHONE_COUNTRIES, country('DE'))[0], 'DE')
})

test('country search finds names in both languages, codes and dial codes', () => {
  const options = [
    { iso: 'IR', dial: '98', name: 'ایران', nameEn: 'Iran' },
    { iso: 'DE', dial: '49', name: 'آلمان', nameEn: 'Germany' },
    { iso: 'AE', dial: '971', name: 'امارات متحدهٔ عربی', nameEn: 'United Arab Emirates' },
  ]
  assert.equal(searchCountries(options, 'germ')[0].iso, 'DE')
  assert.equal(searchCountries(options, 'آلم')[0].iso, 'DE')
  assert.equal(searchCountries(options, 'de')[0].iso, 'DE')
  assert.equal(searchCountries(options, '+49')[0].iso, 'DE')
  assert.equal(searchCountries(options, '۹۸')[0].iso, 'IR')
  assert.equal(searchCountries(options, 'arab')[0].iso, 'AE')
  assert.equal(searchCountries(options, 'nowhere').length, 0)
  assert.equal(searchCountries(options, '').length, 3)
})

test('flag emoji come from the ISO code', () => {
  assert.equal(flagEmoji('IR'), '\u{1F1EE}\u{1F1F7}')
})

test('the server keeps the Iran rule and validates other countries', () => {
  assert.equal(mobilePhone('09120000000'), '+989120000000')
  assert.equal(mobilePhone('+989120000000'), '+989120000000')
  assert.equal(mobilePhone('+4915112345678'), '+4915112345678')
  assert.equal(mobilePhone('+14155552671'), '+14155552671')
  assert.equal(mobilePhone('+493012345678'), null)
  assert.equal(mobilePhone('+4915'), null)
  assert.equal(mobilePhone('123'), null)
  assert.equal(mobilePhone(`+49${'1'.repeat(200)}`), null)
  assert.equal(validPhone('+989120000000'), true)
  assert.equal(validPhone('oldest-excluded'), false)
})

test('mixed identifiers normalize, and sign-in looks up both stored forms', () => {
  assert.equal(normalizePhone(' 0912 345 6789 '), '+989123456789')
  assert.equal(normalizePhone('+44 7911 123456'), '+447911123456')
  assert.equal(normalizePhone('not a phone'), 'not a phone')
  assert.deepEqual(phoneLookupForms('+989123456789'), ['+989123456789', '09123456789'])
  assert.deepEqual(phoneLookupForms('+447911123456'), ['+447911123456'])
})

test('masks keep the calling code, three digits and the last two digits', () => {
  assert.equal(maskPhone('09121234534'), '+98912•••••34')
  assert.equal(maskPhone('+989121234534'), '+98912•••••34')
  assert.equal(maskPhone('+4915112345678'), '+49151•••••78')
  assert.equal(maskPhone('+14155552671'), '+1415•••••71')
  assert.equal(maskPhone('123'), '•••')
  assert.equal(maskPhone('oldest-excluded'), 'olde•••••ed')
})

test('old stored numbers become E.164, and other values stay as they are', () => {
  assert.equal(canonicalPhone('09121234534'), '+989121234534')
  assert.equal(canonicalPhone('+4915112345678'), '+4915112345678')
  assert.equal(canonicalPhone('oldest-excluded'), 'oldest-excluded')
})

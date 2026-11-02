import { parsePhoneNumberFromString, type NumberType } from 'libphonenumber-js/max'
import { canonicalPhone, isE164, isIranMobile, latinDigits, legacyPhone, toE164 } from '../app/lib/phone'

const NOT_A_MOBILE = new Set<NumberType>(['FIXED_LINE', 'TOLL_FREE', 'PREMIUM_RATE', 'SHARED_COST', 'UAN', 'VOICEMAIL'])
const MAX_INPUT_LENGTH = 40
const SHOWN_NATIONAL_DIGITS = 3
const MASK = '•••••'

export function normalizePhone(value: string): string {
  return toE164(value.slice(0, MAX_INPUT_LENGTH)) ?? latinDigits(value).trim()
}

export function validPhone(e164: string): boolean {
  if (isIranMobile(e164)) return true
  return isE164(e164) && Boolean(parsePhoneNumberFromString(e164)?.isValid())
}

export function mobilePhone(value: string): string | null {
  const e164 = toE164(value.slice(0, MAX_INPUT_LENGTH))
  if (!e164 || !validPhone(e164)) return null
  if (isIranMobile(e164)) return e164
  const type = parsePhoneNumberFromString(e164)?.getType()
  return type && NOT_A_MOBILE.has(type) ? null : e164
}

export function phoneLookupForms(phone: string): string[] {
  const legacy = legacyPhone(phone)
  return legacy ? [phone, legacy] : [phone]
}

export function maskPhone(value: string): string {
  const phone = canonicalPhone(value)
  if (phone.length < 7) return '•'.repeat(phone.length)
  const callingCode = isE164(phone) ? parsePhoneNumberFromString(phone)?.countryCallingCode : undefined
  const shown = callingCode ? 1 + callingCode.length + SHOWN_NATIONAL_DIGITS : 4
  return `${phone.slice(0, shown)}${MASK}${phone.slice(-2)}`
}

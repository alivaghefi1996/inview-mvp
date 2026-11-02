import { PRIVACY_PATH } from './consent'
import { DEMO_SLUG, gallerySurfaceSlug } from './galleries'
export type Lang = 'en' | 'fa'
export type Dir = 'rtl' | 'ltr'

export const LANG_COOKIE = 'inview-lang'
const ONE_YEAR = 60 * 60 * 24 * 365

const BILINGUAL_STAFF = ['/ops', '/staff']

function underPath(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`)
}

export function isStaffPath(pathname: string): boolean {
  return underPath(pathname, '/dashboard') || underPath(pathname, '/staff')
}

/** ADR 0002: a gallery opens in Persian, and the Rooz demo opens in English for sales. */
export function defaultLang(pathname: string): Lang {
  if (pathname === '/' || pathname === PRIVACY_PATH || isBilingualStaffPath(pathname)) return 'fa'
  const slug = gallerySurfaceSlug(pathname)
  return slug && slug !== DEMO_SLUG ? 'fa' : 'en'
}

export function readLangCookie(header: string | null | undefined): Lang | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name !== LANG_COOKIE) continue
    const value = rest.join('=')
    if (value === 'en' || value === 'fa') return value
  }
  return null
}

export function isBilingualStaffPath(pathname: string): boolean {
  return BILINGUAL_STAFF.some((base) => underPath(pathname, base))
}

/** The Rooz demo dashboard has English labels only, so the cookie does not apply there. */
export function resolveLang(pathname: string, cookieHeader: string | null | undefined): Lang {
  if (isStaffPath(pathname) && !isBilingualStaffPath(pathname)) return 'en'
  return readLangCookie(cookieHeader) ?? defaultLang(pathname)
}

export function dirFor(lang: Lang): Dir {
  return lang === 'fa' ? 'rtl' : 'ltr'
}

export function langCookie(lang: Lang): string {
  return `${LANG_COOKIE}=${lang}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`
}

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  FALLBACK_COUNTRY,
  PHONE_COUNTRY_KEY,
  countryForNumber,
  flagEmoji,
  pickCountry,
  searchCountries,
  toE164,
  type CountryOption,
  type PhoneCountry,
} from '../lib/phone'

export type PhoneValue = { raw: string; e164: string | null }

export const EMPTY_PHONE: PhoneValue = { raw: '', e164: null }

const IRAN_PLACEHOLDER = '0912 345 6789'

type Labels = { country: string; search: string; searchClose: string; noMatch: string }

type Props = {
  id: string
  lang: 'fa' | 'en'
  labels: Labels
  inputRef?: RefObject<HTMLInputElement>
  invalid?: boolean
  describedBy?: string
  autoComplete?: string
  onChange: (value: PhoneValue) => void
}

function readStoredCountry(): string | null {
  try {
    return localStorage.getItem(PHONE_COUNTRY_KEY)
  } catch {
    return null
  }
}

function storeCountry(iso: string) {
  try {
    localStorage.setItem(PHONE_COUNTRY_KEY, iso)
  } catch {
    return
  }
}

function regionNames(lang: string): (iso: string) => string {
  try {
    const names = new Intl.DisplayNames([lang], { type: 'region' })
    return (iso) => names.of(iso) ?? iso
  } catch {
    return (iso) => iso
  }
}

function countryOptions(countries: readonly PhoneCountry[], lang: string): CountryOption[] {
  const local = regionNames(lang)
  const english = regionNames('en')
  const collator = new Intl.Collator(lang)
  return countries
    .map(([iso, dial]) => ({ iso, dial, name: local(iso), nameEn: english(iso) }))
    .sort((a, b) => collator.compare(a.name, b.name))
}

export function PhoneInput({ id, lang, labels, inputRef, invalid, describedBy, autoComplete = 'tel', onChange }: Props) {
  const [countries, setCountries] = useState<readonly PhoneCountry[]>([FALLBACK_COUNTRY])
  const [country, setCountry] = useState<PhoneCountry>(FALLBACK_COUNTRY)
  const [raw, setRaw] = useState('')
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const toggleRef = useRef<HTMLButtonElement>(null)
  const localRef = useRef<HTMLInputElement>(null)
  const numberRef = inputRef ?? localRef
  const changed = useRef(onChange)
  changed.current = onChange

  useEffect(() => {
    let live = true
    import('../lib/phone-data.generated').then(({ PHONE_COUNTRIES, ZONE_COUNTRIES }) => {
      if (!live) return
      setCountries(PHONE_COUNTRIES)
      setCountry(pickCountry(PHONE_COUNTRIES, ZONE_COUNTRIES, readStoredCountry(), Intl.DateTimeFormat().resolvedOptions().timeZone))
    }).catch(() => undefined)
    return () => { live = false }
  }, [])

  useEffect(() => {
    changed.current({ raw, e164: toE164(raw, country) })
  }, [raw, country])

  const options = useMemo(() => countryOptions(countries, lang), [countries, lang])
  const matches = useMemo(() => searchCountries(options, query), [options, query])
  const noMatch = query.trim() !== '' && matches.length === 0
  const listed = useMemo(() => {
    if (matches.some((option) => option.iso === country[0])) return matches
    const current = options.find((option) => option.iso === country[0])
    return current ? [current, ...matches] : matches
  }, [matches, options, country])

  function choose(iso: string) {
    const next = countries.find((item) => item[0] === iso)
    if (!next) return
    setCountry(next)
    storeCountry(iso)
  }

  function onSearch(next: string) {
    setQuery(next)
    const top = searchCountries(options, next)[0]
    if (next.trim() && top) choose(top.iso)
  }

  function closeSearch(focus: RefObject<HTMLElement>) {
    setSearching(false)
    setQuery('')
    focus.current?.focus()
  }

  const dir = lang === 'fa' ? 'rtl' : 'ltr'
  const selected = options.find((option) => option.iso === country[0])
  return (
    <div className="phone-field">
      <div className="phone-input" dir="ltr">
        <span className="phone-country">
          <span className="phone-country-face" aria-hidden="true">
            <span>{flagEmoji(country[0])}</span>
            <span>{country[0]}</span>
            <span>+{country[1]}</span>
          </span>
          <select aria-label={labels.country} dir={dir} value={country[0]} onChange={(e) => choose(e.target.value)}>
            {listed.map((option) => (
              <option key={option.iso} value={option.iso} suppressHydrationWarning>
                {`${option.name} ‎+${option.dial} ${flagEmoji(option.iso)}`}
              </option>
            ))}
          </select>
        </span>
        <button
          ref={toggleRef}
          type="button"
          className="phone-search-toggle"
          aria-label={searching ? labels.searchClose : labels.search}
          aria-expanded={searching}
          aria-controls={searching ? `${id}-search` : undefined}
          onClick={() => (searching ? closeSearch(toggleRef) : setSearching(true))}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
        </button>
        <input
          id={id}
          ref={numberRef}
          type="tel"
          inputMode="tel"
          autoComplete={autoComplete}
          dir="ltr"
          placeholder={country[0] === FALLBACK_COUNTRY[0] ? IRAN_PLACEHOLDER : undefined}
          value={raw}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            setRaw(e.target.value)
            setCountry((current) => countryForNumber(e.target.value, countries, current))
          }}
        />
      </div>
      {searching && (
        <div className="phone-search">
          <input
            id={`${id}-search`}
            type="search"
            dir={dir}
            autoFocus
            aria-label={labels.search}
            placeholder={labels.search}
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                closeSearch(numberRef)
              } else if (e.key === 'Escape') {
                e.stopPropagation()
                closeSearch(toggleRef)
              }
            }}
          />
          <p className={noMatch ? 'small error' : 'small muted'} role="status">
            {noMatch ? labels.noMatch : selected ? `${selected.name} ‎+${selected.dial}` : ''}
          </p>
        </div>
      )}
    </div>
  )
}

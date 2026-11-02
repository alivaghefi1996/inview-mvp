import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { CONSENT_TEXT_VERSION } from '../lib/consent'
import { DEMO_SLUG } from '../lib/galleries'
import { gallerySlugFromPath, reportLead } from '../lib/pilot'
import { visitor } from '../lib/store'
import { useT } from '../lib/i18n'
import { Heart, Lock } from './Icons'
import { EMPTY_PHONE, PhoneInput, type PhoneValue } from './PhoneInput'

export type SheetKind = 'save' | 'ask' | 'follow' | 'stamp'

const LEAD_WAIT_MS = 3000

interface Props {
  kind: SheetKind
  subtitle?: string
  workId?: string
  onDone: () => void
  onClose: () => void
}

export function SignInSheet({ kind, subtitle, workId, onDone, onClose }: Props) {
  const { t, dir, lang } = useT()
  const gallerySlug = gallerySlugFromPath(useLocation().pathname)
  const isDemo = gallerySlug === DEMO_SLUG
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState<PhoneValue>(EMPTY_PHONE)
  const [sending, setSending] = useState(false)
  const [code, setCode] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // Declared before the focus effect below: React runs effects in order, so this one has to
  // read the opener while it still holds focus.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return closeRef.current()
      if (e.key === 'Tab') trapTab(e, sheetRef.current)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
  }, [step])

  const title = { save: t.sheetSaveTitle, ask: t.sheetAskTitle, follow: t.sheetFollowTitle, stamp: t.sheetStampTitle }[kind]
  const body = kind === 'ask' ? t.sheetAskBody : t.sheetBody

  function agreeOrExplain() {
    if (consent) return true
    setError(t.needConsent)
    return false
  }

  function submitPhone(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.e164) return setError(t.badPhone)
    if (!agreeOrExplain()) return
    setError('')
    if (!isDemo) return void finish(phone.e164)
    setStep('code')
  }

  function submitCode(e: React.FormEvent) {
    e.preventDefault()
    const c = code.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    if (!/^\d{4}$/.test(c)) return setError(t.badCode)
    if (!agreeOrExplain()) return
    if (phone.e164) void finish(phone.e164)
  }

  async function finish(e164: string) {
    if (sending) return
    setSending(true)
    const lead = reportLead(gallerySlug, e164, kind, workId)
    const waited = new Promise<'sent'>((resolve) => setTimeout(() => resolve('sent'), LEAD_WAIT_MS))
    if (await Promise.race([lead, waited]) === 'bad-phone') {
      setSending(false)
      setError(t.badPhone)
      return
    }
    visitor.signIn(e164, CONSENT_TEXT_VERSION)
    onDone()
  }

  function onConsent(next: boolean) {
    setConsent(next)
    if (next) setError('')
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div ref={sheetRef} className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" dir={dir} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" aria-hidden />
        <div className="sheet-head">
          <span className="sheet-icon"><Heart size={22} filled /></span>
          <div>
            <h2 id="sheet-title">{title}</h2>
            {subtitle && <p className="muted small">{subtitle}</p>}
          </div>
        </div>
        <p className="sheet-body">{body}</p>
        {step === 'phone' ? (
          <form onSubmit={submitPhone} className="sheet-form" noValidate>
            <label htmlFor="phone">{t.mobile}</label>
            <PhoneInput
              id="phone"
              lang={lang}
              labels={{ country: t.phoneCountry, search: t.phoneSearch, searchClose: t.phoneSearchClose, noMatch: t.phoneNoMatch }}
              inputRef={inputRef}
              invalid={error === t.badPhone}
              describedBy={error ? 'sheet-error' : undefined}
              onChange={setPhone}
            />
            <ConsentField checked={consent} label={t.consent} invalid={error === t.needConsent} describedBy={error ? 'sheet-error' : undefined} onChange={onConsent} />
            {error && <p id="sheet-error" className="error" role="alert">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={sending}>{isDemo ? t.sendCode : t.confirm}</button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="sheet-form" noValidate>
            <label htmlFor="code">{t.code}</label>
            <input id="code" ref={inputRef} inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={4} placeholder="••••"
              value={code} onChange={(e) => setCode(e.target.value)} aria-invalid={!!error} aria-describedby="sheet-error" className="code-input" />
            <ConsentField checked={consent} label={t.consent} invalid={error === t.needConsent} describedBy="sheet-error" onChange={onConsent} />
            <p id="sheet-error" className={error ? 'error' : 'muted small'} role={error ? 'alert' : undefined}>{error || t.codeHint}</p>
            <button className="btn btn-primary" type="submit" disabled={sending}>{t.confirm}</button>
          </form>
        )}
        <p className="privacy"><Lock size={16} />{t.privacy}</p>
        <button className="btn-text" onClick={onClose}>{t.notNow}</button>
      </div>
    </div>
  )
}

function ConsentField({
  checked,
  label,
  invalid,
  describedBy,
  onChange,
}: {
  checked: boolean
  label: string
  invalid: boolean
  describedBy?: string
  onChange: (next: boolean) => void
}) {
  return (
    <label className="consent">
      <input
        type="checkbox"
        checked={checked}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

const focusable = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function trapTab(e: KeyboardEvent, root: HTMLElement | null) {
  if (!root) return
  const items = Array.from(root.querySelectorAll<HTMLElement>(focusable))
  if (items.length === 0) return
  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement
  if (!root.contains(active)) {
    e.preventDefault()
    first.focus()
  } else if (e.shiftKey && active === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

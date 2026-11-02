import { Link } from 'react-router'
import { GateBrand } from '../../components/GateBrand'
import { StaffLangSwitch } from '../../components/StaffLangSwitch'
import { useOwlWatch, WatchOwl } from '../../components/WatchOwl'
import { useStaffT } from '../../lib/i18n-staff'

export type SignInError = 'wrong' | 'limited' | ''
export type SignInMode = 'account' | 'code'

function modeHref(mode: SignInMode, next?: string) {
  const query = new URLSearchParams()
  if (mode === 'code') query.set('mode', 'code')
  if (next) query.set('next', next)
  const search = query.toString()
  return `/staff/sign-in${search ? `?${search}` : ''}`
}

export function StaffSignIn({ error = '', mode = 'account', next }: { error?: SignInError; mode?: SignInMode; next?: string }) {
  const { t, lang, dir } = useStaffT()
  const { pose, look, watchers } = useOwlWatch()
  const message = error === 'limited' ? t.tooMany : error === 'wrong' ? t.wrongSignIn : ''
  return (
    <main className={`gate staff-${lang}`} dir={dir}>
      <aside className="gate-panel" aria-hidden>
        <h2>{t.signInPanelTitle}</h2>
        <p>{t.signInPanelBody}</p>
      </aside>
      <div className="gate-card">
        <div className="row between gap">
          <GateBrand />
          <StaffLangSwitch />
        </div>
        <span className="ink-rule" aria-hidden />
        <h1>{t.signInTitle}</h1>
        <nav className="gate-modes" aria-label={t.signInModes}>
          <Link to={modeHref('account', next)} aria-current={mode === 'account' ? 'page' : undefined}>{t.signInAccountTab}</Link>
          <Link to={modeHref('code', next)} aria-current={mode === 'code' ? 'page' : undefined}>{t.signInCodeTab}</Link>
        </nav>
        {mode === 'account' ? (
          <form method="post" {...watchers}>
            <div className="gate-field">
              <label htmlFor="identifier">{t.identifier}</label>
              <div className="gate-perch">
                <WatchOwl pose={pose} look={look} alert={Boolean(message)} />
                <input id="identifier" name="identifier" dir="ltr" required maxLength={320} autoComplete="username" />
              </div>
            </div>
            <div className="gate-field">
              <label htmlFor="password">{t.password}</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                maxLength={1024}
                autoComplete="current-password"
                aria-describedby={message ? 'sign-in-msg' : undefined}
                aria-invalid={message ? true : undefined}
              />
            </div>
            {message && <p id="sign-in-msg" className="error" role="alert">{message}</p>}
            <button className="btn btn-primary" type="submit">{t.signInButton}</button>
            <Link className="gate-link" to="/staff/forgot-password">{t.forgotLink}</Link>
          </form>
        ) : (
          <form method="post" {...watchers}>
            <input type="hidden" name="intent" value="shared-code" />
            <div className="gate-field">
              <label htmlFor="gallery">{t.gallerySlug}</label>
              <div className="gate-perch">
                <WatchOwl pose={pose} look={look} alert={Boolean(message)} />
                <input id="gallery" name="gallery" dir="ltr" required pattern="[a-z0-9][a-z0-9-]{0,79}" autoComplete="off" />
              </div>
            </div>
            <div className="gate-field">
              <label htmlFor="access-code">{t.accessCode}</label>
              <input
                id="access-code"
                name="accessCode"
                type="password"
                dir="ltr"
                autoComplete="current-password"
                required
                aria-describedby="access-msg"
                aria-invalid={message ? true : undefined}
              />
            </div>
            <p id="access-msg" className={message ? 'error' : 'muted small'} role={message ? 'alert' : undefined}>
              {message || t.signInHint}
            </p>
            <button className="btn btn-primary" type="submit">{t.signInButton}</button>
          </form>
        )}
      </div>
    </main>
  )
}

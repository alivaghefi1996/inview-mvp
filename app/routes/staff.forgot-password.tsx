import { data, Link, useActionData, useLoaderData } from 'react-router'
import { database } from '../../database/context'
import { mailFromEnv } from '../../server/mail'
import { requestPasswordReset } from '../../server/password-reset'
import { GateBrand } from '../components/GateBrand'
import { StaffLangSwitch } from '../components/StaffLangSwitch'
import { useOwlWatch, WatchOwl } from '../components/WatchOwl'
import { panelMeta } from '../lib/panel-meta'
import { staffDictionaries, useStaffT } from '../lib/i18n-staff'
import { redirectIfSignedIn, requireStaffOrigin } from './staff-session.server'

export const meta = panelMeta(staffDictionaries, 'forgotTitle')

export function headers() {
  return { 'Cache-Control': 'no-store' }
}

export async function loader({ request }: { request: Request }) {
  return (await redirectIfSignedIn(request)) ?? { mailEnabled: Boolean(mailFromEnv()) }
}

export async function action({ request, context }: { request: Request; context: { clientIp?: string } }) {
  requireStaffOrigin(request)
  const send = mailFromEnv()
  if (!send) return data({ state: 'off' as const }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  const form = await request.formData()
  const result = await requestPasswordReset(database(), {
    email: String(form.get('email') || ''),
    ip: context.clientIp ?? 'unknown',
    appUrl: process.env.PUBLIC_APP_URL || new URL(request.url).origin,
  }, send)
  if (result.status === 'limited') return data({ state: 'limited' as const }, { status: 429, headers: { 'Cache-Control': 'no-store' } })
  return data({ state: 'sent' as const }, { headers: { 'Cache-Control': 'no-store' } })
}

export default function StaffForgotPassword() {
  const { mailEnabled } = useLoaderData() as { mailEnabled: boolean }
  const result = useActionData() as { state?: 'sent' | 'limited' | 'off' } | undefined
  const { t, lang, dir } = useStaffT()
  const { pose, look, watchers } = useOwlWatch()
  const sent = result?.state === 'sent'
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
        <h1>{t.forgotTitle}</h1>
        {sent ? <p role="status">{t.forgotSent}</p> : !mailEnabled || result?.state === 'off' ? <p>{t.forgotOff}</p> : (
          <form method="post" {...watchers}>
            <p className="muted small">{t.forgotBody}</p>
            <div className="gate-field">
              <label htmlFor="email">{t.forgotEmail}</label>
              <div className="gate-perch">
                <WatchOwl pose={pose} look={look} alert={result?.state === 'limited'} />
                <input id="email" name="email" type="email" dir="ltr" required maxLength={320} autoComplete="email" />
              </div>
            </div>
            {result?.state === 'limited' && <p className="error" role="alert">{t.tooMany}</p>}
            <button className="btn btn-primary" type="submit">{t.forgotButton}</button>
          </form>
        )}
        <Link className="gate-link" to="/staff/sign-in">{t.forgotBack}</Link>
      </div>
    </main>
  )
}

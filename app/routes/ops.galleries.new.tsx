import { Form, Link, useActionData } from 'react-router'
import { database } from '../../database/context'
import { createGallery } from '../../server/ops'
import { OneTimeValue, OpsSubmit } from '../components/OpsUi'
import { useOpsT } from '../lib/i18n-ops'
import { readLangCookie } from '../lib/lang'
import { AccountInputError } from '../../server/accounts'
import { actionFailure, field, operatorFor, privateHeaders, requireOrigin } from './ops-session.server'
import { panelMeta } from '../lib/panel-meta'
import { opsDictionaries } from '../lib/i18n-ops'

export const meta = panelMeta(opsDictionaries, 'newGallery')

export const headers = privateHeaders
export async function loader({ request }: { request: Request }) {
  await operatorFor(request)
  return null
}
function errorForLang(error: unknown, lang: string | null): { error: true; message: string; invitePath: null; code: null; slug: null; saved: false } {
  if (error instanceof AccountInputError) {
    return { error: true, message: lang === 'fa' ? (error.messageFa ?? error.message) : error.message, invitePath: null, code: null, slug: null, saved: false }
  }
  throw new Response('The request failed.', { status: 500, headers: privateHeaders() })
}

export async function action({ request }: { request: Request }) {
  const principal = await operatorFor(request)
  requireOrigin(request)
  const form = await request.formData()
  try {
    const result = await createGallery(database(), principal, { slug: field(form, 'slug'), nameFa: field(form, 'nameFa'), nameEn: field(form, 'nameEn'), showTitle: field(form, 'showTitle'), ownerIdentifier: field(form, 'ownerIdentifier') })
    return { error: false, message: null, invitePath: result.invitePath, slug: result.gallery.slug }
  } catch (error) { return errorForLang(error, readLangCookie(request.headers.get('cookie'))) }
}

export default function NewGallery() {
  const { t, lang, dir } = useOpsT()
  const result = useActionData<typeof action>()
  return <><h1>{t.newGallery}</h1>
    {result?.invitePath ? <><OneTimeValue value={result.invitePath} label={t.inviteLink} /><Link to={`/ops/galleries/${result.slug}`}>{t.profile}</Link></> :
      <Form method="post" className="ops-form">
        <label>{t.slug}<input name="slug" required pattern="[a-z0-9-]{3,40}" minLength={3} maxLength={40} dir="ltr" /></label>
        <label>{t.nameFa}<input name="nameFa" required maxLength={80} dir="rtl" /></label>
        <label>{t.nameEn}<input name="nameEn" required maxLength={80} dir="ltr" /></label>
        <label>{t.showTitle}<input name="showTitle" required maxLength={160} /></label>
        <label>{t.ownerIdentifier}<input name="ownerIdentifier" required maxLength={320} dir="ltr" autoComplete="off" /></label>
        {result?.error && (result.message
          ? <p className="error" role="alert" lang={lang} dir={dir}>{result.message}</p>
          : <p className="error" role="alert">{t.invalidFields}</p>)}
        <OpsSubmit>{t.newGallery}</OpsSubmit>
      </Form>}
  </>
}

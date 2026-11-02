import { useLoaderData } from 'react-router'
import { database } from '../../database/context'
import { listInquiries } from '../../server/inquiries'
import { useOpsT } from '../lib/i18n-ops'
import { operatorFor, privateHeaders } from './ops-session.server'
import { panelMeta } from '../lib/panel-meta'
import { opsDictionaries } from '../lib/i18n-ops'

export const meta = panelMeta(opsDictionaries, 'inquiries')

export const headers = privateHeaders
export async function loader({ request }: { request: Request }) {
  const principal = await operatorFor(request)
  return { inquiries: await listInquiries(database(), principal) }
}

export default function Inquiries() {
  const { inquiries } = useLoaderData<typeof loader>()
  const { t, format } = useOpsT()
  return <><h1>{t.inquiries}</h1><p>{t.inquiriesLimit}</p>
    <div className="ops-team">{inquiries.map((inquiry) => <section key={inquiry.id} className="ops-member">
      <h2><bdi>{inquiry.galleryName}</bdi></h2>
      <p>{t.contactPerson}: <bdi>{inquiry.contactPerson}</bdi> · <bdi dir="ltr">{inquiry.contact}</bdi></p>
      <p className="ops-inquiry-message"><bdi>{inquiry.message}</bdi></p>
      <p>{t.time}: {format.dateTime(String(inquiry.createdAt))} · {t.consent}: <bdi>{inquiry.consentTextVersion}</bdi></p>
      <p>{t.taskState}: {inquiry.state === 'created'
        ? <>{t.taskCreated} {inquiry.taskUrl ? <a href={inquiry.taskUrl}><bdi>{inquiry.identifier}</bdi></a> : <bdi>{inquiry.identifier}</bdi>}</>
        : <>{t.taskPending} · {t.taskAttempts}: {format.number(inquiry.attempts)}{inquiry.lastError && <> · <bdi dir="ltr">{inquiry.lastError}</bdi></>}</>}</p>
    </section>)}</div>{!inquiries.length && <p>{t.noRows}</p>}
  </>
}

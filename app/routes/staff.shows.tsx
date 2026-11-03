import { useState } from 'react'
import { Form, Link, data, useActionData, useLoaderData } from 'react-router'
import { database } from '../../database/context'
import { AccountInputError } from '../../server/accounts'
import { can } from '../../server/authz'
import { staffHeaders, staffTenant } from '../../server/staff'
import { archiveShow, galleryShows, publishShow, startNewShow } from '../../server/shows'
import { PermissionError } from '../../server/team'
import { readLangCookie } from '../lib/lang'
import { panelMeta } from '../lib/panel-meta'
import { staffDictionaries, useStaffT } from '../lib/i18n-staff'
import { GalleryStaffLayout } from '../pages/gallery/GalleryStaffLayout'
import { requireStaffOrigin } from './staff-session.server'

export const meta = panelMeta(staffDictionaries, 'navShows')

export const headers = staffHeaders
export async function loader({ request, params }: { request: Request; params: { slug?: string } }) {
  const db = database()
  const { principal, tenant } = await staffTenant(db, request, params.slug ?? '', 'view-report')
  return {
    gallery: { slug: tenant.gallery.slug, nameEn: tenant.gallery.nameEn, nameFa: tenant.gallery.nameFa },
    shows: await galleryShows(db, tenant.gallery.id),
    permissions: (['edit-catalogue', 'manage-staff', 'create-qr'] as const).filter((action) => can(principal, action, tenant.gallery.id)),
  }
}
export async function action({ request, params }: { request: Request; params: { slug?: string } }) {
  const db = database()
  const { principal, tenant } = await staffTenant(db, request, params.slug ?? '', 'edit-catalogue')
  requireStaffOrigin(request)
  const form = await request.formData()
  const galleryId = tenant.gallery.id
  const showId = String(form.get('show') ?? '')
  try {
    const intent = form.get('intent')
    if (intent === 'start') {
      const show = await startNewShow(db, principal, galleryId)
      return new Response(null, { status: 302, headers: { ...staffHeaders(), Location: `/staff/${tenant.gallery.slug}?show=${show.id}` } })
    }
    if (!/^[0-9a-f-]{36}$/.test(showId)) throw new AccountInputError('That show was not found.', 'نمایش پیدا نشد.')
    if (intent === 'publish') await publishShow(db, principal, galleryId, showId)
    else if (intent === 'archive') await archiveShow(db, principal, galleryId, showId)
    else throw new AccountInputError('Invalid action.', 'درخواست نامعتبر است.')
    return { error: null }
  } catch (error) {
    if (error instanceof PermissionError) throw new Response('Forbidden', { status: 403, headers: staffHeaders() })
    if (error instanceof AccountInputError) {
      const message = readLangCookie(request.headers.get('cookie')) === 'en' ? error.message : error.messageFa ?? error.message
      return data({ error: message }, { status: 400, headers: staffHeaders() })
    }
    throw error
  }
}

function ConfirmedAction({ show, intent, label, confirm }: { show: string; intent: 'publish' | 'archive'; label: string; confirm: string }) {
  const { t } = useStaffT()
  const [asking, setAsking] = useState(false)
  if (!asking) return <button className={`btn small-btn ${intent === 'publish' ? 'btn-primary' : 'btn-outline'}`} type="button" onClick={() => setAsking(true)}>{label}</button>
  return <>
    <p role="status">{confirm}</p>
    <Form method="post">
      <input type="hidden" name="show" value={show} />
      <button className="btn btn-primary small-btn" type="submit" name="intent" value={intent}>{t.confirmAction}</button>
    </Form>
    <button className="btn btn-quiet small-btn" type="button" onClick={() => setAsking(false)}>{t.cancelAction}</button>
  </>
}

export default function StaffShows() {
  const { gallery, shows, permissions } = useLoaderData<typeof loader>()
  const result = useActionData<typeof action>()
  const { t, lang, format } = useStaffT()
  const canEdit = permissions.includes('edit-catalogue')
  const statusLabel = { published: t.showCurrent, draft: t.showNext, archived: t.showArchived }
  const hasCurrent = shows.some((show) => show.status === 'published')
  const hasDraft = shows.some((show) => show.status === 'draft')
  return <GalleryStaffLayout gallery={gallery} permissions={permissions} titleKey="navShows">
    <div className="shows-page">
      <p>{t.showsIntro}</p>
      {result && 'error' in result && result.error && <p className="error" role="alert">{result.error}</p>}
      {!hasCurrent && <p className="show-notice" role="status">{t.noCurrentShow}</p>}
      {canEdit && !hasDraft && <Form className="shows-start" method="post">
        <button className="btn btn-primary" type="submit" name="intent" value="start">{t.startShow}</button>
        <p className="muted small">{t.startShowNote}</p>
      </Form>}
      <ol className="show-ledger">
        {shows.map((show) => {
          const title = (lang === 'fa' ? show.titleFa || show.titleEn : show.titleEn || show.titleFa) || t.untitledShow
          const dates = lang === 'fa' ? show.datesFa || show.datesEn : show.datesEn || show.datesFa
          return <li key={show.id} className={`show-row show-row-${show.status}`}>
            <div>
              <p className="show-row-status">{statusLabel[show.status]}</p>
              <h2><bdi>{title}</bdi></h2>
              {dates && <p className="show-row-dates">{dates}</p>}
            </div>
            <dl className="show-row-counts">
              <div><dt>{t.scans}</dt><dd>{format.number(show.scans)}</dd></div>
              <div><dt>{t.views}</dt><dd>{format.number(show.views)}</dd></div>
              <div><dt>{t.leadsTotal}</dt><dd>{format.number(show.leads)}</dd></div>
            </dl>
            <div className="show-row-actions">
              {show.status !== 'draft' && <Link className="btn btn-outline small-btn" to={`/staff/${gallery.slug}/report?show=${show.id}`}>{t.openReport}<span className="sr-only"> <bdi>{title}</bdi></span></Link>}
              {canEdit && show.status !== 'archived' && <Link className="btn btn-outline small-btn" to={`/staff/${gallery.slug}?show=${show.id}`}>{t.editShow}<span className="sr-only"> <bdi>{title}</bdi></span></Link>}
              {canEdit && show.status === 'draft' && <ConfirmedAction show={show.id} intent="publish" label={t.publishShow} confirm={t.publishShowConfirm} />}
              {canEdit && show.status === 'published' && <ConfirmedAction show={show.id} intent="archive" label={t.archiveShow} confirm={t.archiveShowConfirm} />}
            </div>
          </li>
        })}
      </ol>
    </div>
  </GalleryStaffLayout>
}

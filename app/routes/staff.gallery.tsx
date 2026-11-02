import { useLoaderData } from 'react-router'
import GalleryEditor from '../pages/gallery/GalleryEditor'
import { GalleryStaffLayout } from '../pages/gallery/GalleryStaffLayout'
import { staffHeaders } from '../../server/staff'
import { galleryData } from './staff-session.server'
import { panelMeta } from '../lib/panel-meta'
import { staffDictionaries } from '../lib/i18n-staff'

export const meta = panelMeta(staffDictionaries, 'pageTitle')

export const headers = staffHeaders
export async function loader({ request, params }: { request: Request; params: { slug?: string } }) {
  return galleryData(request, params.slug ?? '', 'view-report')
}
export default function StaffGallery() {
  const { gallery, record, report, permissions } = useLoaderData<typeof loader>()
  const reportOnly = !permissions.includes('edit-catalogue')
  return <GalleryStaffLayout gallery={gallery} permissions={permissions} titleKey={reportOnly ? null : 'pageTitle'}><GalleryEditor key={gallery.slug} initialRecord={record} initialReport={report} canExport={permissions.includes('export-leads')} reportOnly={reportOnly} /></GalleryStaffLayout>
}

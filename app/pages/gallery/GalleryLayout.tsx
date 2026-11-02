import { NavLink, Outlet, useLocation, useNavigation } from 'react-router'
import { SkipLink } from '../../components/SkipLink'
import { StaffLangSwitch } from '../../components/StaffLangSwitch'
import { useStaffT } from '../../lib/i18n-staff'
import { useDashboardT } from '../../lib/i18n-dashboard'
import { gallery, report, show } from '../../data/gallery'

export default function GalleryLayout() {
  const { pathname } = useLocation()
  const busy = useNavigation().state !== 'idle'
  const { t: staff } = useStaffT()
  const { t, lang, dir, n, percent } = useDashboardT()
  const fa = lang === 'fa'
  const page = pathname.endsWith('/website') ? t.navWebsite : pathname.endsWith('/plans') ? t.navPlans : null
  const galleryName = fa ? gallery.nameFa : gallery.name

  return (
    <div className={`dash ${fa ? 'staff-fa' : ''}`} dir={dir}>
      <SkipLink label={staff.skipToContent} />
      <aside className="side" aria-label={t.galleryAside}>
        <p className="brand">{staff.brand} <span>{staff.brandSub}</span></p>
        <p className="demo-flag" role="note"><strong>{t.demoLabel}</strong> {t.demoFlag}</p>
        <div className="side-gallery">
          <span className="avatar sq">{t.galleryInitials}</span>
          <span>
            <strong>{galleryName}</strong>
            <span className="muted small">{t.demoPlan}</span>
          </span>
        </div>
        <StaffLangSwitch />
        <nav aria-label={t.dashboardNav}>
          <NavLink to="/dashboard" end>{t.navReport}</NavLink>
          <NavLink to="/dashboard/artworks">{t.navArtworks}</NavLink>
          <NavLink to="/dashboard/audience">{t.navAudience}</NavLink>
          <NavLink to="/dashboard/website">{t.navWebsite}</NavLink>
          <NavLink to="/dashboard/plans">{t.navPlans}</NavLink>
        </nav>
      </aside>
      <main id="main" tabIndex={-1} className="dash-main" aria-busy={busy || undefined}>
        <header className="dash-head">
          {page ? (
            <div>
              <p className="muted small">{galleryName}</p>
              <h1>{page}</h1>
            </div>
          ) : (
            <>
              <div>
                <p className="muted small">{t.showLine(fa ? show.kindFa : show.kind, fa ? show.datesFa : show.dates, n(report.dayOf), n(report.days))}</p>
                <h1>{fa ? show.titleFa : show.title}</h1>
              </div>
              <span className="pill good">{t.scansVsLast(percent(report.vsLastShow))}</span>
            </>
          )}
        </header>
        <Outlet />
      </main>
    </div>
  )
}

import { ArtworkInterest } from '~/pages/gallery/Dashboard'
import { dashboardDictionaries } from '~/lib/i18n-dashboard'
import { panelMeta } from '~/lib/panel-meta'

export const meta = panelMeta(dashboardDictionaries, 'navArtworks')

export default function DashboardArtworks() {
  return <ArtworkInterest />
}

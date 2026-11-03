import { Audience } from '~/pages/gallery/Dashboard'
import { dashboardDictionaries } from '~/lib/i18n-dashboard'
import { panelMeta } from '~/lib/panel-meta'

export const meta = panelMeta(dashboardDictionaries, 'navAudience')

export default function DashboardAudience() {
  return <Audience />
}

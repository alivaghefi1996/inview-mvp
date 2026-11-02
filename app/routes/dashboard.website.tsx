import Import from '~/pages/gallery/Import'
import { dashboardDictionaries } from '~/lib/i18n-dashboard'
import { panelMeta } from '~/lib/panel-meta'

export const meta = panelMeta(dashboardDictionaries, 'navWebsite')

export default function DashboardWebsite() {
  return <Import />
}

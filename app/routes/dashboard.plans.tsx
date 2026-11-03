import Plans from '~/pages/gallery/Plans'
import { dashboardDictionaries } from '~/lib/i18n-dashboard'
import { panelMeta } from '~/lib/panel-meta'

export const meta = panelMeta(dashboardDictionaries, 'navPlans')

export default function DashboardPlans() {
  return <Plans />
}

import { Overview } from '~/pages/gallery/Dashboard'

export const meta = () => [{ title: 'Show report · Inview demo' }, { name: 'robots', content: 'noindex' }]

export default function DashboardHome() {
  return <Overview />
}

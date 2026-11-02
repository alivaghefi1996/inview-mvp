import { Link } from 'react-router'
import { useStaffT } from '../lib/i18n-staff'

export function GateBrand() {
  const { t } = useStaffT()
  return <Link className="brand gate-brand" to="/">{t.brand} <span>{t.brandSub}</span></Link>
}

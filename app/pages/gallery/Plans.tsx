import { plans } from '../../data/gallery'
import { useDashboardT } from '../../lib/i18n-dashboard'

export default function Plans() {
  const { t, lang, n, digits } = useDashboardT()
  const fa = lang === 'fa'
  const price = (value: number, from: boolean) => (value === 0 ? t.free : from ? t.fromPrice(n(value)) : n(value))
  return (
    <>
      <p id="plans-demo-note" className="pill warn" role="note">{t.plansDemo}</p>
      <p className="muted no-m">{t.plansNote}</p>
      <div className="plans">
        {plans.map((p) => {
          const name = fa ? p.nameFa : p.name
          return (
            <section key={p.name} className="plan">
              <p className="plan-tag">{fa ? p.tagFa : p.tag}</p>
              <h2>{name}</h2>
              <p className="plan-price">{price(p.monthly, p.from)}{p.monthly !== 0 && <span>{t.perMonth}</span>}</p>
              <p className="muted small no-m">{p.annual === 0 ? t.alwaysFree : t.perYear(price(p.annual, p.from))}</p>
              <p className="plan-addr">{fa ? p.addressFa : p.address}</p>
              <ul role="list">{(fa ? p.featuresFa : p.features).map((f) => <li key={f}>{digits(f)}</li>)}</ul>
              <button className="btn btn-outline small-btn" disabled aria-describedby="plans-demo-note">{t.choosePlan(name)}</button>
            </section>
          )
        })}
      </div>
    </>
  )
}

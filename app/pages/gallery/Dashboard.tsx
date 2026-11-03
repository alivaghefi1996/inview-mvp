import { artworks, report, type Artwork } from '../../data/gallery'
import { Link } from 'react-router'
import { Lock } from '../../components/Icons'
import { formatSize, formatWeekdayDay } from '../../lib/format'
import { useDashboardT } from '../../lib/i18n-dashboard'

const signalClass = { sold: 'sig-sold', hot: 'sig-hot', quiet: 'sig-quiet', low: 'sig-low' }

function useDashboardView() {
  const view = useDashboardT()
  const { t, lang, n } = view
  const fa = lang === 'fa'
  const pad = (value: number) => (value < 10 ? `0${value}` : String(value))
  return {
    ...view,
    label: (item: { label: string; labelFa: string }) => (fa ? item.labelFa : item.label),
    artist: (a: Artwork) => (fa ? a.artistFa ?? a.artist : a.artist),
    title: (a: Artwork) => (fa ? a.titleFa ?? a.title : a.title),
    medium: (a: Artwork) => (fa ? a.mediumFa : a.medium),
    size: (a: Artwork) => formatSize(lang, fa ? a.size.replace('cm', 'سانتی‌متر') : a.size),
    signal: (a: Artwork) => (fa ? a.signalTextFa : a.signalText),
    status: (a: Artwork) => ({ available: t.available, reserved: t.reservedStatus, sold: t.sold })[a.status],
    avgTime: (a: Artwork) => {
      const seconds = a.avgSeconds % 60
      const minutes = Math.floor(a.avgSeconds / 60)
      return fa ? t.duration(n(minutes), n(seconds)) : t.duration(String(minutes), pad(seconds))
    },
    day: (date: string) => formatWeekdayDay(lang, date),
    dimensions: (a: Artwork) => formatSize(lang, a.size.replace(' cm', '')),
  }
}

export function Overview() {
  const { t, n, percent, millions, label, artist, dimensions, day } = useDashboardView()
  const top = report.funnel[0].value
  const signedIn = report.funnel[2].value
  const sold = artworks.filter((a) => a.status === 'sold')
  const reserved = artworks.filter((a) => a.status === 'reserved').length
  const salesValue = sold.reduce((s, a) => s + a.price, 0)
  const maxDay = Math.max(...report.scansPerDay.map((d) => d.value))
  const fridayShare = Math.round((report.scansPerDay.filter((d) => d.friday).reduce((s, d) => s + d.value, 0) / report.scansPerDay.reduce((s, d) => s + d.value, 0)) * 100)
  const hot = artworks.find((a) => a.signal === 'hot')!
  const kpis = [
    [t.kpiSignedIn, n(signedIn), t.ofScanners(percent(Math.round((signedIn / top) * 100)))],
    [t.kpiSaved, n(report.saves), t.byPeople(n(report.funnel[3].value))],
    [t.kpiInquiries, n(report.funnel[4].value), t.askedAbout],
    [t.kpiSold, `${n(sold.length)} / ${n(artworks.length)}`, t.reserved(n(reserved))],
    [t.kpiSales, millions(salesValue), t.salesNote],
  ]
  return (
    <>
      <section className="kpi-lead" aria-label={t.summary}>
        <div className="kpi-main"><span className="muted small">{t.uniqueScanned}</span><strong>{n(top)}</strong><span className="muted tiny">{t.dayOf(n(report.dayOf), n(report.days))}</span></div>
        <dl className="kpi-row">
          {kpis.map(([l, v, s]) => (<div key={l}><dt className="muted small">{l}</dt><dd><strong>{v}</strong><span className="muted tiny">{s}</span></dd></div>))}
        </dl>
      </section>
      <div className="two">
        <section className="box">
          <h2>{t.funnelTitle}</h2>
          <ul className="bars" role="list">
            {report.funnel.map((f) => {
              const pct = (f.value / top) * 100
              return (
                <li key={f.label}>
                  <span className="bar-label">{label(f)}</span>
                  <span className="bar-track"><span className="bar pine" style={{ width: `${Math.max(pct, 1.5)}%` }} /></span>
                  <span className="bar-value"><strong>{n(f.value)}</strong> <span className="muted">{pct < 10 ? percent(pct, 1) : percent(Math.round(pct))}</span></span>
                </li>
              )
            })}
          </ul>
        </section>
        <section className="box">
          <h2>{t.scansPerDay}</h2>
          <div className="cols" role="img" aria-label={t.scansPerDayLabel(report.scansPerDay.map((d) => `${day(d.date)} ${n(d.value)}`).join(t.listSeparator))}>
            {report.scansPerDay.map((d) => (
              <span key={d.date} className="col-wrap">
                <span className={`col ${d.friday ? 'copper' : ''}`} style={{ height: `${(d.value / maxDay) * 100}%` }}>
                  <span className="col-value" aria-hidden>{n(d.value)}</span>
                </span>
                <span className="col-label">{day(d.date)}</span>
              </span>
            ))}
          </div>
          <p className="small">{t.fridayShare(percent(fridayShare))}</p>
        </section>
      </div>
      <div className="steps">
        <div className="step">
          <span className="muted-inv small">{t.nextStep}</span>
          <p>{t.hotStep(n(hot.saves), artist(hot), dimensions(hot), millions(hot.price))}</p>
          <span className="row gap wrap"><button type="button" className="btn btn-light" disabled aria-describedby="step-demo">{t.draftMessage}</button><span id="step-demo" className="demo-tag">{t.demoLabel}</span></span>
        </div>
        <div className="step">
          <span className="muted-inv small">{t.nextStep}</span>
          <p>{t.leadsStep(n(report.funnel[4].value), n(report.leads.length))}</p>
          <Link className="btn btn-light" to="/dashboard/audience">{t.openLeads}</Link>
        </div>
      </div>
    </>
  )
}

export function ArtworkInterest() {
  const { t, n, millions, artist, title, medium, size, signal, status, avgTime, percent } = useDashboardView()
  const sorted = [...artworks].sort((a, b) => b.saves - a.saves)
  const hot = artworks.filter((a) => a.signal === 'hot')
  const most = sorted[0]
  const entrance = report.sources[0]
  const label = report.sources[1]
  const named = (a: Artwork) => `${title(a) ? `${title(a)}${t.listSeparator}` : ''}${artist(a)}`
  return (
    <>
      <div className="kpis three">
        <div className="kpi"><span className="muted small">{t.mostSaved}</span><strong className="kpi-name">{named(most)}</strong><span className="muted tiny">{t.savesSignal(n(most.saves), signal(most))}</span></div>
        <div className="kpi warm"><span className="small">{t.highInterest}</span><strong>{t.worksCount(n(hot.length))}</strong><span className="tiny">{t.openValue(n(hot.reduce((s, a) => s + a.saves, 0)), millions(hot.reduce((s, a) => s + a.price, 0)))}</span></div>
        <div className="kpi"><span className="muted small">{t.labelScans}</span><strong>{percent(label.share)}</strong><span className="muted tiny">{t.versusEntrance(percent(entrance.share))}</span></div>
      </div>
      <div className="box flush scroll-x" tabIndex={0} role="region" aria-label={t.artworkTable}>
        <table>
          <thead><tr><th>{t.colWork}</th><th className="num">{t.colPrice}</th><th className="num">{t.colViews}</th><th className="num">{t.colAvgTime}</th><th className="num">{t.colSaves}</th><th className="num">{t.colInquiries}</th><th>{t.colStatus}</th><th>{t.colSignal}</th></tr></thead>
          <tbody>
            {sorted.map((a) => (
              <tr key={a.id}>
                <td><span className="work-cell"><img src={a.image} alt="" /><span><strong>{artist(a)}</strong><span className="muted small">{title(a) ? `${title(a)}${t.listSeparator}` : ''}{medium(a)}{t.listSeparator}{size(a)}</span></span></span></td>
                <td className="num">{n(a.price)}</td>
                <td className="num">{n(a.views)}</td>
                <td className="num">{avgTime(a)}</td>
                <td className="num"><strong>{n(a.saves)}</strong></td>
                <td className="num">{n(a.inquiries)}</td>
                <td className={`st-${a.status}`}>{status(a)}</td>
                <td><span className={`sig ${signalClass[a.signal]}`}>{signal(a)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function Audience() {
  const { t, lang, n, percent, label, digits } = useDashboardView()
  const personaLabel = (name: string) => {
    const found = report.personas.find((p) => p.label === name)
    return found ? label(found) : name
  }
  return (
    <>
      <div className="two">
        <section className="box">
          <h2>{t.whoCame}</h2>
          <ul className="bars" role="list">
            {report.personas.map((p) => (
              <li key={p.label}><span className="bar-label">{label(p)}</span><span className="bar-track"><span className="bar copper" style={{ width: `${p.share}%` }} /></span><span className="bar-value"><strong>{percent(p.share)}</strong></span></li>
            ))}
          </ul>
        </section>
        <section className="box">
          <h2>{t.howFound}</h2>
          <ul className="bars" role="list">
            {report.sources.map((p) => (
              <li key={p.label}><span className="bar-label">{label(p)}</span><span className="bar-track"><span className="bar pine" style={{ width: `${p.share}%` }} /></span><span className="bar-value"><strong>{percent(p.share)}</strong></span></li>
            ))}
          </ul>
          <div className="split"><div><strong>{percent(report.newVisitors)}</strong><span className="muted small">{t.newVisitors}</span></div><div><strong>{percent(100 - report.newVisitors)}</strong><span className="muted small">{t.returningVisitors}</span></div></div>
        </section>
      </div>
      <section className="box flush scroll-x" tabIndex={0} role="region" aria-label={t.audienceTable}>
        <div className="row between box-head"><h2>{t.priorityLeads}</h2><span className="muted small">{t.sharedContact} <span id="contact-demo">{t.contactOff}</span></span></div>
        <table>
          <thead><tr><th>{t.colPerson}</th><th>{t.colProfile}</th><th>{t.colScore}</th><th>{t.colWhy}</th><th>{t.colContact}</th></tr></thead>
          <tbody>
            {report.leads.map((l) => (
              <tr key={l.number}>
                <td><span className="work-cell"><span className="avatar">{t.visitorInitial}{n(l.number)}</span><strong>{t.sampleVisitor(n(l.number))}</strong></span></td>
                <td><span className="sig sig-quiet">{personaLabel(l.persona)}</span></td>
                <td><span className="score"><span className="bar-track mini"><span className="bar copper" style={{ width: `${l.score}%` }} /></span><strong>{n(l.score)}</strong></span></td>
                <td className="why">{lang === 'fa' ? digits(formatSize(lang, l.whyFa)) : l.why}</td>
                <td><button type="button" className="btn btn-outline small-btn" disabled aria-describedby="contact-demo">{l.contact === 'call' ? t.call : t.message}</button></td>
              </tr>
            ))}
            <tr className="locked"><td colSpan={4}><span className="row gap"><Lock />{t.lockedLeads(n(report.lockedLeads))}</span></td><td><Link className="btn btn-primary small-btn" to="/dashboard/plans">{t.seePlans}</Link></td></tr>
          </tbody>
        </table>
      </section>
    </>
  )
}

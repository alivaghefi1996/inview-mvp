import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { artworks, gallery, importDemo } from '../../data/gallery'
import { formatSize } from '../../lib/format'
import { useDashboardT } from '../../lib/i18n-dashboard'

// Demo only: the import step returns the sample results from gallery.ts.
type Stage = 'empty' | 'reading' | 'review' | 'published'

export default function Import() {
  const { t, lang, n, digits } = useDashboardT()
  const fa = lang === 'fa'
  const [stage, setStage] = useState<Stage>('empty')
  const [files, setFiles] = useState<string[]>([])
  const [demoFiles, setDemoFiles] = useState(false)
  const [error, setError] = useState('')
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(importDemo.rows.map((r) => [r.id, r.ok])),
  )
  const input = useRef<HTMLInputElement>(null)
  const siteUrl = `/site/${gallery.slug}`

  function start(names: string[], demo = false) {
    if (names.length === 0) {
      setError(t.noFile)
      return
    }
    setError('')
    setFiles(names)
    setDemoFiles(demo)
    setStage('reading')
    window.setTimeout(() => setStage('review'), 1600)
  }

  const result = (file: (typeof importDemo.files)[number]) =>
    ({ works: t.resultWorks, shows: t.resultShows, bios: t.resultBios })[file.kind](n(file.count))
  const approved = Object.values(checked).filter(Boolean).length
  const rest = importDemo.found.artworks - importDemo.rows.length

  return (
    <>
      <div className="row between wrap gap">
        <p className="muted small no-m">{t.websiteIntro}</p>
        <p className="pill warn" role="note">{t.importDemo}</p>
        <Link to={siteUrl} className="pill good" target="_blank" rel="noreferrer">{t.websiteLive}</Link>
      </div>

      <div className="two">
        <section className="box">
          <h2>{t.dropTitle}</h2>
          <button type="button" className="dropzone" aria-describedby={error ? 'import-error' : undefined} onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); start(Array.from(e.dataTransfer.files).map((f) => f.name)) }}>
            {t.dropLineOne}<br />{t.dropLineTwo}
            <span className="small">{t.dropHint}</span>
          </button>
          <input ref={input} type="file" multiple hidden aria-label={t.chooseFiles} onChange={(e) => start(Array.from(e.target.files ?? []).map((f) => f.name))} />
          {error && <p id="import-error" className="error small" role="alert">{error}</p>}
          {stage === 'empty' && <button type="button" className="btn-text" onClick={() => start(importDemo.files.map((f) => f.name), true)}>{t.useDemoFiles}</button>}
          {files.length > 0 && (
            <ul className="files" role="list">
              {files.map((f, i) => (
                <li key={f}><span>{demoFiles && fa ? importDemo.files[i].nameFa : f}</span><span className="ok small">{stage === 'reading' ? t.reading : importDemo.files[i] ? t.readResult(result(importDemo.files[i])) : t.readDone}</span></li>
              ))}
            </ul>
          )}
        </section>
        <section className="box dark">
          <h2>{t.sortTitle}</h2>
          {stage === 'empty' && <p>{t.sortEmpty}</p>}
          {stage === 'reading' && <p role="status">{t.readingFiles}</p>}
          {(stage === 'review' || stage === 'published') && (
            <>
              <div className="found">
                <div><strong>{n(importDemo.found.artworks)}</strong><span>{t.foundArtworks}</span></div>
                <div><strong>{n(importDemo.found.artists)}</strong><span>{t.foundArtists}</span></div>
                <div><strong>{n(importDemo.found.shows)}</strong><span>{t.foundShows}</span></div>
              </div>
              <p>{t.reviewLead}<b className="warm">{t.reviewNeed(n(importDemo.rows.filter((r) => !r.ok).length))}</b>{t.reviewTail}</p>
            </>
          )}
          <h2 className="mt">{t.approveTitle}</h2>
          <p>{t.approveBody}</p>
        </section>
      </div>

      {(stage === 'review' || stage === 'published') && (
        <section className="box flush scroll-x" tabIndex={0} role="region" aria-label={t.previewTable}>
          <div className="row between box-head"><h2>{t.reviewTitle}</h2><span className="muted small">{t.showing(n(importDemo.rows.length), n(importDemo.found.artworks))}</span></div>
          <table>
            <thead><tr><th>{t.colWork}</th><th>{t.colMedium}</th><th>{t.colYear}</th><th className="num">{t.colPrice}</th><th>{t.colFoundIn}</th><th>{t.colNote}</th><th>{t.colApprove}</th></tr></thead>
            <tbody>
              {importDemo.rows.map((r) => {
                const a = artworks.find((w) => w.id === r.artworkId)!
                return (
                  <tr key={r.id}>
                    <td><span className="work-cell"><img src={a.image} alt="" /><span><strong>{fa ? a.artistFa : a.artist}</strong><span className="muted small">{fa ? a.artist : a.artistFa}</span></span></span></td>
                    <td>{fa ? a.mediumFa : a.medium}{fa ? '، ' : ', '}{formatSize(lang, fa ? a.size.replace('cm', 'سانتی‌متر') : a.size)}</td>
                    <td>{digits(a.year)}</td>
                    <td className="num">{r.ok ? n(a.price) : t.unclear}</td>
                    <td className="muted">{fa ? r.sourceFa : r.source}</td>
                    <td><span className={`sig ${r.ok ? 'sig-quiet' : 'sig-hot'}`}>{fa ? r.noteFa : r.note}</span></td>
                    <td><label className="check-hit"><input type="checkbox" className="check" aria-label={t.approveWork(fa ? a.artistFa ?? a.artist : a.artist)} checked={!!checked[r.id]} onChange={(e) => setChecked({ ...checked, [r.id]: e.target.checked })} /></label></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="row gap wrap actions-bar">
            <span className="muted small">{t.approvedCount(n(approved + rest), n(importDemo.found.artworks))}</span>
            {stage === 'published'
              ? <Link className="btn btn-primary small-btn" to={siteUrl} target="_blank" rel="noreferrer">{t.published}</Link>
              : <button type="button" className="btn btn-primary small-btn" onClick={() => setStage('published')}>{t.publish}</button>}
          </div>
        </section>
      )}
    </>
  )
}

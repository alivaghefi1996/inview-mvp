import { Link } from 'react-router'
import { artworks, gallery, passportGoal, passportHistory } from '../../data/gallery'
import { DEMO_SLUG, galleryBase, isDatabaseGallery } from '../../lib/galleries'
import { useT } from '../../lib/i18n'
import { pick } from '../../lib/pilot'
import { isDemoVisitor, useVisitor, visitor, type SavedWork, type VisitStamp } from '../../lib/store'
import { useSignIn } from '../../components/VisitorShell'
import { Calendar } from '../../components/Icons'
import { WorkImage } from './OGalleryPages'

const faStamps: Record<string, string> = {
  H: 'ه',
  S: 'س',
  '0': '۰',
  B: 'ب',
  V: 'و',
  O: 'ا',
  A: 'آ',
  K: 'ک',
  N: 'ن',
  R: 'ر',
}

function stampMark(mark: string, lang: 'en' | 'fa') {
  if (lang !== 'fa') return mark
  return faStamps[mark] ?? 'م'
}

function DemoPassport({ marks }: { marks: string[] }) {
  const { t, n, lang } = useT()
  const filled = Math.min(marks.length, passportGoal)
  return (
    <section className="panel">
      <div className="row between"><h2 className="panel-title">{t.passport}</h2><span className="muted small">{n(filled)} / {n(passportGoal)}</span></div>
      <div className="progress" role="progressbar" aria-label={t.passport} aria-valuenow={filled} aria-valuemin={0} aria-valuemax={passportGoal}>
        <span style={{ width: `${(filled / passportGoal) * 100}%` }} />
      </div>
      <ul className="stamps" role="list">
        {Array.from({ length: passportGoal }, (_, i) => (
          <li key={i} className={i < filled ? (marks[i] === 'R' ? 'stamp here' : i % 3 === 0 ? 'stamp copper' : 'stamp') : 'stamp open'}>
            {i < filled ? stampMark(marks[i], lang) : ''}
          </li>
        ))}
      </ul>
      <p className="muted small">{t.passportLeft(Math.max(passportGoal - filled, 0))}</p>
    </section>
  )
}

function VisitPassport({ stamps }: { stamps: VisitStamp[] }) {
  const { t, lang } = useT()
  return (
    <section className="panel">
      <h2 className="panel-title">{t.passport}</h2>
      {stamps.length === 0 ? (
        <p className="muted small no-m">{t.noStamps}</p>
      ) : (
        <ul className="stamps" role="list">
          {stamps.map((stamp) => {
            const name = pick(lang, stamp.name, stamp.nameFa) || stamp.gallery
            return (
              <li key={`${stamp.gallery}:${stamp.showId}`} className="stamp here" title={name}>
                <span aria-hidden>{Array.from(name)[0]}</span>
                <span className="sr-only">{name}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function SavedRealWork({ work }: { work: SavedWork }) {
  const { t, lang } = useT()
  const title = pick(lang, work.title, work.titleFa) || t.untitled
  const artist = pick(lang, work.artist, work.artistFa)
  return (
    <li>
      <Link to={`${galleryBase(work.gallery)}/works/${work.id}`}>
        {work.image ? <WorkImage work={work} alt="" sizes="(min-width: 960px) 20vw, 33vw" /> : <span className="saved-blank" aria-hidden />}
        <strong dir="auto">{title}</strong>
        {artist && <span className="saved-artist" dir="auto">{artist}</span>}
      </Link>
    </li>
  )
}

export default function Profile() {
  const { t, n, artist, status } = useT()
  const state = useVisitor()
  const { phone, saved, savedWorks, follows, stamps, visitStamps, lastGallery } = state
  const { requireSignIn } = useSignIn()
  const demo = isDemoVisitor(state, DEMO_SLUG, artworks.map((a) => a.id))

  if (!phone) {
    return (
      <>
        <div className="pad empty">
          <h1 className="page-title">{t.profile}</h1>
          <p className="muted">{t.signInPrompt}</p>
          <button className="btn btn-primary" onClick={() => requireSignIn('save', () => undefined)}>{t.signIn}</button>
        </div>
        {visitStamps.length > 0 && <VisitPassport stamps={visitStamps} />}
      </>
    )
  }

  const demoWorks = demo ? artworks.filter((a) => saved.includes(a.id)) : []
  const realWorks = savedWorks.filter((work) => saved.includes(work.id))
  const savedCount = demoWorks.length + realWorks.length
  const marks = [...passportHistory, ...stamps.map(() => 'R'), ...visitStamps.map(() => 'R')]
  const galleriesVisited = demo ? Math.min(marks.length, passportGoal) : new Set(visitStamps.map((stamp) => stamp.gallery)).size
  const worksGallery = demo ? gallery.slug : isDatabaseGallery(lastGallery?.slug) ? lastGallery?.slug : undefined

  return (
    <div className="profile">
      <div className="pad row gap">
        <span className="avatar" aria-hidden>{phone.slice(-2)}</span>
        <div>
          <h1 className="page-title no-m">{t.profile}</h1>
          <p className="muted small" dir="ltr">{phone.replace(/(\d{4})(\d{3})(\d{4})/, '$1 $2 $3')}</p>
        </div>
      </div>
      <div className={`stats pad ${demo ? '' : 'stats-two'}`}>
        <div><strong>{n(galleriesVisited)}</strong><span>{t.galleriesVisited}</span></div>
        <div><strong>{n(savedCount)}</strong><span>{t.savedWorks}</span></div>
        {demo && <div><strong>{n(follows.length)}</strong><span>{t.artistsFollowed}</span></div>}
      </div>
      {demo ? <DemoPassport marks={marks} /> : <VisitPassport stamps={visitStamps} />}
      <section className="pad">
        <h2 className="panel-title">{t.savedWorks}</h2>
        {savedCount === 0 ? (
          <p className="muted">{t.noSaved}{worksGallery && <> <Link to={`${galleryBase(worksGallery)}/works`}>{t.artworks}</Link></>}</p>
        ) : (
          <ul className="saved" role="list">
            {realWorks.map((work) => <SavedRealWork key={work.id} work={work} />)}
            {demoWorks.map((a) => (
              <li key={a.id}>
                <Link to={`/g/${gallery.slug}/works/${a.id}`}>
                  <img src={a.image} alt="" />
                  <strong>{artist(a)}</strong>
                  <span className={`status s-${a.status}`}>{status(a.status)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {demo && (
        <section className="panel row gap">
          <span className="mark pine" aria-hidden><Calendar /></span>
          <div><strong>{t.thisFriday}</strong><p className="muted small no-m">{t.thisFridaySub}</p></div>
        </section>
      )}
      <div className="pad row gap wrap">
        <button className="btn-text" onClick={visitor.signOut}>{t.signOut}</button>
        {demo && <button className="btn-text" onClick={visitor.reset}>{t.resetDemo}</button>}
      </div>
    </div>
  )
}

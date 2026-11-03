import { useState } from 'react'
import { Link, useLoaderData, useParams } from 'react-router'
import OGallerySite from './OGallerySite'
import { EMPTY_PHONE, PhoneInput, type PhoneValue } from '../../components/PhoneInput'
import { SkipLink } from '../../components/SkipLink'
import { artists, artworks, gallery, pastShows, show } from '../../data/gallery'
import { isDatabaseGallery } from '../../lib/galleries'
import { seed, type GalleryPageData } from '../../lib/pilot'
import { highFetchPriority } from '../../lib/image-priority'

export default function Website() {
  const { slug } = useParams()
  // `/` has no slug, so it carries no pilot record and shows the demo website.
  const { pilot } = useLoaderData() as Partial<GalleryPageData>
  if (isDatabaseGallery(slug)) return <OGallerySite record={pilot ?? seed} />
  return <RoozWebsite />
}

function RoozWebsite() {
  const [phone, setPhone] = useState<PhoneValue>(EMPTY_PHONE)
  const [result, setResult] = useState<'' | 'done' | 'error'>('')
  const available = artworks.filter((a) => a.status !== 'sold')
  const cover = artworks[1]

  function follow(e: React.FormEvent) {
    e.preventDefault()
    setResult(phone.e164 ? 'done' : 'error')
  }

  const showLink = `/g/${gallery.slug}`
  const sections = [
    { id: 'exhibitions', label: 'Exhibitions', shown: pastShows.length > 0 },
    { id: 'artists', label: 'Artists', shown: artists.length > 0 },
    { id: 'works', label: 'Available works', shown: available.length > 0 },
  ]
  return (
    <div className="site" id="top">
      <SkipLink label="Skip to content" />
      <header className="site-top">
        <a href="#top" className="site-brand">{gallery.name.toUpperCase()}</a>
        <nav aria-label="Website">
          <a href="#current">Current show</a>
          {sections.filter((section) => section.shown).map((section) => <a key={section.id} href={`#${section.id}`}>{section.label}</a>)}
          <a href="#visit">Visit</a>
        </nav>
      </header>

      <main id="main" tabIndex={-1}>
        <section className="site-hero" id="current">
          <div className="site-hero-text">
            <p className="muted">Now showing, {show.dates}</p>
            <h1>{show.title}</h1>
            <p className="site-kind">{show.kind}, {artists.length} artists</p>
            <p className="site-lead">{show.text}</p>
            <div className="row gap wrap">
              <Link className="btn btn-primary" to={`${showLink}/works`}>See the works</Link>
              <Link className="btn btn-outline" to={`${showLink}/prices`}>Price list</Link>
            </div>
          </div>
          <img src={cover.image} alt={cover.alt} className="site-hero-img" width={cover.width} height={cover.height} {...highFetchPriority} />
        </section>

        <form className="site-follow" onSubmit={follow} noValidate>
          <p><strong>Next opening:</strong> announced soon. Follow the gallery to get the invitation.</p>
          <div className="row gap wrap">
            <label htmlFor="site-phone" className="sr-only">Mobile number</label>
            <PhoneInput
              id="site-phone"
              lang="en"
              labels={{ country: 'Country code', search: 'Search for a country', searchClose: 'Close the country search', noMatch: 'No country matches this search.' }}
              invalid={result === 'error'}
              describedBy={result ? 'site-follow-msg' : undefined}
              onChange={(value) => { setPhone(value); if (value.raw !== phone.raw) setResult('') }}
            />
            <button className="btn btn-primary" type="submit">Follow</button>
          </div>
          {result === 'error' && <p id="site-follow-msg" className="small error" role="alert">Enter a valid mobile number.</p>}
          {result === 'done' && <p id="site-follow-msg" className="small" role="status">Demo: no SMS is sent.</p>}
        </form>

        {sections[0].shown && (
          <section className="site-section" id="exhibitions">
            <div className="row between wrap gap">
              <h2>Past exhibitions</h2>
              <p className="muted small">Inview adds each show here when it closes</p>
            </div>
            <div className="site-grid">
              {pastShows.map((p) => (
                <article key={p.title} className="site-card">
                  <img src={p.image} alt="" />
                  <h3>{p.title}</h3>
                  <p className="muted small">{p.kind}, {p.date}</p>
                  <span className="site-chip">Archived from the show’s QR page</span>
                </article>
              ))}
            </div>
          </section>
        )}

        {sections[1].shown && (
          <section className="site-section" id="artists">
            <h2>Artists</h2>
            <ul className="site-artists" role="list">
              {artists.map((name) => {
                const w = artworks.find((a) => a.artist === name)!
                return (
                  <li key={name}><img src={w.image} alt="" /><span>{name}</span></li>
                )
              })}
            </ul>
          </section>
        )}

        {sections[2].shown && (
          <section className="site-section" id="works">
            <h2>Available works</h2>
            <div className="site-grid">
              {available.map((a) => (
                <Link key={a.id} to={`${showLink}/works/${a.id}`} className="site-card link">
                  <img src={a.image} alt={a.alt} />
                  <h3>{a.artist}</h3>
                  <p className="muted small">{a.title ?? 'Untitled'}, {a.medium}, {a.size}</p>
                  <p className="small"><strong>{a.price.toLocaleString('en-US')} Toman</strong>{a.status === 'reserved' ? ' (reserved)' : ''}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="site-foot" id="visit">
        <div>
          <p className="site-brand light">{gallery.name.toUpperCase()}</p>
          <p>{gallery.address}<br />{gallery.hours}<br />Instagram <a className="text-link" href={`https://instagram.com/${gallery.instagram}`}>@{gallery.instagram}</a></p>
        </div>
        <p className="site-made">Website by Inview</p>
      </footer>
    </div>
  )
}

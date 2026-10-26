import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { gallery } from './data/gallery'
import { VisitorShell } from './components/VisitorShell'
import Welcome from './pages/visitor/Welcome'
import Works from './pages/visitor/Works'
import Work from './pages/visitor/Work'
import Prices from './pages/visitor/Prices'
import About from './pages/visitor/About'
import Profile from './pages/visitor/Profile'
import GalleryLayout from './pages/gallery/GalleryLayout'
import { ArtworkInterest, Audience, Overview } from './pages/gallery/Dashboard'

function NotFound() {
  return (
    <div className="pad empty">
      <h1 className="page-title">This page doesn’t exist</h1>
      <p className="muted">Scan the QR code at the gallery again, or open the current show.</p>
      <Link className="btn btn-primary" to={`/g/${gallery.slug}`}>Open the show</Link>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/g/${gallery.slug}`} replace />} />
      <Route element={<VisitorShell />}>
        <Route path="/g/:slug" element={<Welcome />} />
        <Route path="/g/:slug/works" element={<Works />} />
        <Route path="/g/:slug/works/:id" element={<Work />} />
        <Route path="/g/:slug/prices" element={<Prices />} />
        <Route path="/g/:slug/about" element={<About />} />
        <Route path="/me" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="/dashboard" element={<GalleryLayout />}>
        <Route index element={<Overview />} />
        <Route path="artworks" element={<ArtworkInterest />} />
        <Route path="audience" element={<Audience />} />
      </Route>
    </Routes>
  )
}

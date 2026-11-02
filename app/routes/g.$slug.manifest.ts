import { GALLERY_SLUG_PATTERN } from '../../server/gallery-record'
import { galleryManifest } from '../lib/manifest'

export function loader({ params }: { params: { slug?: string } }) {
  const slug = params.slug ?? ''
  if (!GALLERY_SLUG_PATTERN.test(slug)) throw new Response('Not found', { status: 404 })
  return new Response(JSON.stringify(galleryManifest(slug)), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-cache' },
  })
}

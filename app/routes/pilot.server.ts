import { database } from '../../database/context'
import { galleryNotFound, loadPublicPage } from '../../server/gallery-record'
import { artworks } from '../data/gallery'
import { DEMO_SLUG } from '../lib/galleries'
import type { GalleryPageData, PilotRecord, PilotWork } from '../lib/pilot'

export function notFound(): Response {
  return galleryNotFound()
}

function unavailable(): Response {
  return new Response('The catalogue is not available.', { status: 503, headers: { 'Cache-Control': 'no-store' } })
}

export async function loadGalleryPage(
  _request: Request,
  slug: string | undefined,
): Promise<GalleryPageData> {
  if (!slug) throw notFound()
  if (slug === DEMO_SLUG) return { pilot: null }
  let page: { record: PilotRecord } | null
  try {
    page = await loadPublicPage(database(), slug)
  } catch (error) {
    console.error('Gallery loader failed', error)
    throw unavailable()
  }
  if (!page) throw notFound()
  return { pilot: page.record }
}

export async function loadWorkPage(
  request: Request,
  slug: string | undefined,
  id: string | undefined,
): Promise<GalleryPageData & { work: PilotWork | null }> {
  const page = await loadGalleryPage(request, slug)
  if (slug === DEMO_SLUG) {
    if (!artworks.some((artwork) => artwork.id === id)) throw notFound()
    return { ...page, work: null }
  }
  if (!page.pilot) throw unavailable()
  const work = page.pilot.works.find((item) => item.id === id)
  if (!work) throw notFound()
  return { ...page, work }
}

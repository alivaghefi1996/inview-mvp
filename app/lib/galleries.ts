import { gallery } from '../data/gallery'

/** The sales demo. Its pages come from `app/data/gallery.ts`. */
export const DEMO_SLUG = gallery.slug

export function isDatabaseGallery(slug: string | undefined): boolean {
  return Boolean(slug) && slug !== DEMO_SLUG
}

export function galleryBase(slug: string): string {
  return `/g/${slug}`
}

/** `/g/:slug` is the visitor app and `/site/:slug` is the website. Both belong to one gallery. */
export function gallerySurfaceSlug(pathname: string): string | null {
  return pathname.match(/^\/(?:g|site)\/([^/]+)/)?.[1] ?? null
}

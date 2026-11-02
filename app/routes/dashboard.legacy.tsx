import { redirect } from 'react-router'
import { GALLERY_SLUG_PATTERN } from '../../server/gallery-record'
export function loader({ request, params }: { request: Request; params: { slug?: string } }) {
  const slug = params.slug ?? ''
  if (!GALLERY_SLUG_PATTERN.test(slug)) throw new Response('Not found', { status: 404 })
  return redirect(`/staff/${slug}${new URL(request.url).search}`, 302)
}

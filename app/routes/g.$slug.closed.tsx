import { data, useLoaderData, type MetaFunction } from 'react-router'
import { database } from '../../database/context'
import { galleryBetweenShows, loadPublicPage } from '../../server/gallery-record'
import { useT } from '~/lib/i18n'
import { metaCopy, rootData } from '~/lib/meta'
import { pick } from '~/lib/pilot'

const headers = { 'Cache-Control': 'no-store' }

export async function loader({ params }: { params: { slug?: string } }) {
  const slug = params.slug ?? ''
  const db = database()
  if (await loadPublicPage(db, slug)) throw new Response(null, { status: 302, headers: { ...headers, Location: `/g/${slug}` } })
  const gallery = await galleryBetweenShows(db, slug)
  if (!gallery) throw data(null, { status: 404, headers })
  return data({ gallery }, { headers })
}

export const meta: MetaFunction = ({ matches }) => {
  const words = metaCopy(rootData(matches).lang)
  return [{ title: words.site }, { name: 'robots', content: 'noindex' }]
}

export default function GalleryClosed() {
  const { gallery } = useLoaderData<typeof loader>()
  const { t, lang, dir } = useT()
  return (
    <main className="pad empty" dir={dir}>
      <p className="muted">{pick(lang, gallery.nameEn, gallery.nameFa)}</p>
      <h1 className="page-title">{t.noShowTitle}</h1>
      <p className="muted">{t.noShowBody}</p>
    </main>
  )
}

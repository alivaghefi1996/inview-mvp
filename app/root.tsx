import { gallerySurfaceSlug } from './lib/galleries'
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useMatches,
  useRouteLoaderData,
} from 'react-router'
import type { Route } from './+types/root'
import { useT } from './lib/i18n'
import { metaCopy } from './lib/meta'
import { dirFor, resolveLang } from './lib/lang'
import { APP_MANIFEST_PATH, galleryManifestPath } from './lib/manifest'
import { ServiceWorker } from './components/ServiceWorker'
import { DeferredHydration } from './components/DeferredHydration'
import fraunces400 from '@fontsource/fraunces/files/fraunces-latin-400-normal.woff2?url'
import fraunces500 from '@fontsource/fraunces/files/fraunces-latin-500-normal.woff2?url'
// A stylesheet link adds a round trip before the first paint, and on a mobile connection it
// shares the bandwidth with every module script. Both sheets fit inside the document instead.
import persianFontFaces from './styles-fa.css?inline'
import appStyles from './styles.css?inline'

export type SerifHandle = { usesMediumSerif?: (data: unknown) => boolean }

export const links: Route.LinksFunction = () => [
  { rel: 'icon', href: '/icons/favicon.svg', type: 'image/svg+xml' },
  { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
]

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const lang = resolveLang(url.pathname, request.headers.get('cookie'))
  const origin = (process.env.PUBLIC_APP_URL || url.origin).replace(/\/$/, '')
  const slug = gallerySurfaceSlug(url.pathname)
  return { lang, dir: dirFor(lang), origin, manifest: slug ? galleryManifestPath(slug) : APP_MANIFEST_PATH }
}

export const meta: Route.MetaFunction = ({ data }) => {
  const words = metaCopy(data?.lang ?? 'en')
  return [{ title: words.site }, { name: 'description', content: words.tagline }]
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>('root')
  const persian = data?.lang === 'fa'
  const page = useMatches().at(-1)
  const handle = page?.handle as SerifHandle | undefined
  const mediumSerif = handle?.usesMediumSerif?.(page?.data) ?? true
  return (
    <html lang={data?.lang ?? 'en'} dir={data?.dir ?? 'ltr'}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#17332E" />
        <Meta />
        <Links />
        <style dangerouslySetInnerHTML={{ __html: appStyles }} />
        <link rel="manifest" href={data?.manifest ?? APP_MANIFEST_PATH} />
        {persian ? (
          <style dangerouslySetInnerHTML={{ __html: persianFontFaces }} />
        ) : (
          <>
            <link rel="preload" href={fraunces400} as="font" type="font/woff2" crossOrigin="anonymous" />
            {mediumSerif && <link rel="preload" href={fraunces500} as="font" type="font/woff2" crossOrigin="anonymous" />}
          </>
        )}
      </head>
      <body>
        {children}
        <ServiceWorker />
        <ScrollRestoration />
        <Scripts />
        <DeferredHydration />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t, dir } = useT()
  const missing = isRouteErrorResponse(error) && error.status === 404
  return (
    <main className="pad empty" dir={dir}>
      <h1 className="page-title">{missing ? t.notFound : t.loadFailed}</h1>
      <p className="muted">{missing ? t.notFoundBody : t.loadFailedBody}</p>
      <Link className="btn btn-outline" to="/">{t.goHome}</Link>
      {import.meta.env.DEV && error instanceof Error && <pre className="muted small">{error.message}</pre>}
    </main>
  )
}

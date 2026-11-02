/** Everything a web app manifest holds except the surface it starts at. */
export const APP_MANIFEST = {
  name: 'Inview',
  short_name: 'Inview',
  lang: 'fa',
  dir: 'rtl' as const,
  description: 'The show, the works and the prices, in your pocket.',
  theme_color: '#203F3B',
  background_color: '#E7E3D9',
  display: 'standalone' as const,
  scope: '/',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}

export const APP_MANIFEST_PATH = '/manifest.webmanifest'

export function galleryManifestPath(slug: string): string {
  return `/g/${slug}/manifest.webmanifest`
}

/**
 * A browser identifies an installed app by `id`, and falls back to `start_url` when a
 * manifest omits it. Repeating `start_url` here therefore keeps every install made at
 * `/g/<slug>` before this route existed, and gives each gallery a separate app.
 */
export function galleryManifest(slug: string) {
  const start = `/g/${slug}`
  return { ...APP_MANIFEST, id: start, start_url: start }
}

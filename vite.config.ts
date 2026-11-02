import { reactRouter } from '@react-router/dev/vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { VitePWA } from 'vite-plugin-pwa'
import { APP_MANIFEST } from './app/lib/manifest'

export default defineConfig(({ isSsrBuild }) => ({
  build: {
    // The CSP sets font-src 'self', so the browser blocks a font inlined as a data: URI.
    assetsInlineLimit: (file: string) =>
      /\.(?:woff2?|ttf|otf|eot)$/i.test(file) ? false : undefined,
    rollupOptions: isSsrBuild
      ? {
          input: './server/app.ts',
        }
      : undefined,
  },
  plugins: [
    reactRouter(),
    tsconfigPaths(),
    !isSsrBuild &&
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png', 'offline.html'],
        injectRegister: false,
        // A page outside a gallery starts at the landing page. `/g/:slug` serves its own manifest.
        manifest: { ...APP_MANIFEST, id: '/', start_url: '/' },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          globIgnores: ['artworks/**', '**/*latin-ext*', '**/*cyrillic*', '**/*vietnamese*'],
          navigateFallback: null,
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) =>
                request.mode === 'navigate' &&
                !url.pathname.startsWith('/dashboard') &&
                !url.pathname.startsWith('/ops') &&
                !url.pathname.startsWith('/staff') &&
                !url.pathname.startsWith('/api'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'pages',
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 64 },
                precacheFallback: { fallbackURL: '/offline.html' },
              },
            },
            {
              urlPattern: ({ request, url }) => request.destination === 'image' && !url.pathname.startsWith('/api'),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'media',
                expiration: { maxEntries: 128 },
              },
            },
          ],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
      }),
  ].filter(Boolean),
}))

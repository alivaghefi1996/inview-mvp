import { expect, test } from '@playwright/test'

test('the visitor app installs a worker and shows the offline page', async ({ page, context }) => {
  await page.goto('/g/o-gallery')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/g/o-gallery/manifest.webmanifest')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)

  await context.setOffline(true)
  await page.goto('/g/o-gallery/about?offline-check=1')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('اتصال اینترنت برقرار نیست')
  await expect(page.getByRole('heading', { name: 'You are offline' })).toBeVisible()
  await context.setOffline(false)
})

test('the manifest names the app in Persian order with valid icons', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest')
  expect(response.ok()).toBeTruthy()
  const manifest = await response.json()
  expect(manifest).toMatchObject({ id: '/', lang: 'fa', dir: 'rtl', start_url: '/', display: 'standalone' })
  for (const icon of manifest.icons as Array<{ src: string }>) {
    expect((await request.get(icon.src)).ok(), icon.src).toBeTruthy()
  }
  expect(response.headers()['cache-control']).toBe('no-cache')
})

test('each gallery starts its installed app at its own pages', async ({ request }) => {
  // An install made at /g/o-gallery keeps this id, so it stays the app the pilot visitors have.
  const pilot = await request.get('/g/o-gallery/manifest.webmanifest')
  expect(pilot.ok()).toBeTruthy()
  expect(pilot.headers()['content-type']).toContain('application/manifest+json')
  expect(await pilot.json()).toMatchObject({ id: '/g/o-gallery', start_url: '/g/o-gallery', lang: 'fa', dir: 'rtl' })

  const sample = await request.get('/g/sample/manifest.webmanifest')
  expect(sample.ok()).toBeTruthy()
  expect(await sample.json()).toMatchObject({ id: '/g/sample', start_url: '/g/sample', display: 'standalone' })

  expect((await request.get('/g/Not A Slug/manifest.webmanifest')).status()).toBe(404)
})

test('the worker never handles staff pages', async ({ request }) => {
  const sw = await (await request.get('/sw.js')).text()
  expect(sw).toContain('/dashboard')
  expect(sw).toContain('/staff')
  expect(sw).toContain('offline.html')
})

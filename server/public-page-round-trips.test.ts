import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.PUBLIC_RECORD_TTL_MS = '5000'
delete process.env.O_GALLERY_ACCESS_CODE

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../database/schema.ts'
import { ensureOGalleryTenant } from './gallery-bootstrap.ts'
import { loadPublicPage, PUBLIC_RECORD_TTL_MS } from './gallery-record.ts'
import { handlePilotApi } from './pilot-api.ts'
import { LocalObjectStorage } from './storage.ts'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const baseUrl = process.env.SEED_TEST_DATABASE_URL || process.env.DATABASE_URL

function databaseUrl(base: string, name: string, port?: number) {
  const url = new URL(base)
  url.pathname = `/${name}`
  if (port) {
    url.hostname = '127.0.0.1'
    url.port = String(port)
  }
  return url.toString()
}

async function startTurnCounter(base: string) {
  const target = new URL(base)
  const turns = { count: 0 }
  const sockets = new Set<net.Socket>()
  const server = net.createServer((client) => {
    const upstream = net.connect(Number(target.port || 5432), target.hostname)
    let awaitingReply = false
    for (const socket of [client, upstream]) {
      sockets.add(socket)
      socket.on('error', () => socket.destroy())
    }
    client.on('data', (chunk) => {
      if (!awaitingReply) turns.count += 1
      awaitingReply = true
      upstream.write(chunk)
    })
    upstream.on('data', (chunk) => {
      awaitingReply = false
      client.write(chunk)
    })
    client.on('close', () => upstream.destroy())
    upstream.on('close', () => client.destroy())
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  return {
    turns,
    port: (server.address() as net.AddressInfo).port,
    close: () => {
      for (const socket of sockets) socket.destroy()
      server.close()
    },
  }
}

test(
  'a public page read on an open connection takes one round trip for each query',
  { skip: baseUrl ? false : 'Set SEED_TEST_DATABASE_URL or DATABASE_URL to a Postgres server.' },
  async () => {
    const name = `inview_round_trip_test_${process.pid}`
    const admin = postgres(databaseUrl(String(baseUrl), 'postgres'), { max: 1, onnotice: () => {} })
    await admin.unsafe(`CREATE DATABASE ${name}`)
    const url = databaseUrl(String(baseUrl), name)
    const counter = await startTurnCounter(String(baseUrl))
    const mediaRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'inview-round-trip-'))
    const direct = postgres(url, { max: 1, onnotice: () => {} })
    const client = postgres(databaseUrl(String(baseUrl), name, counter.port), { max: 1, onnotice: () => {} })
    try {
      execFileSync(process.execPath, ['scripts/migrate.mjs'], { cwd: ROOT, env: { PATH: process.env.PATH, DATABASE_URL: url }, stdio: 'ignore' })
      const db = drizzle(client, { schema })
      const tenant = await ensureOGalleryTenant(db as never)
      const [logo] = await db
        .insert(schema.media)
        .values({ galleryId: tenant.gallery.id, s3Key: 'logo', width: 10, height: 10, variants: { 'w320.webp': '/logo.webp' } })
        .returning()
      await db.update(schema.galleries).set({ logoMediaId: logo.id }).where(eq(schema.galleries.id, tenant.gallery.id))

      const publish = async (showTitle: string) => {
        const result = await handlePilotApi(db as never, new LocalObjectStorage(mediaRoot), 'PUT', {
          accessCode: 'inview',
          gallery: tenant.gallery.slug,
          record: {
            name: 'O Gallery',
            nameFa: 'گالری اُ',
            showTitle,
            works: [{ id: 'roundtrip01', title: 'Harbour light', artist: 'N. Karimi', medium: 'Oil', size: '40 x 50', year: '2024', price: 1000000, status: 'available', image: '', sample: false }],
          },
        })
        assert.equal(result.status, 200)
      }
      const measure = async <T>(read: () => Promise<T>) => {
        counter.turns.count = 0
        const value = await read()
        return { value, turns: counter.turns.count }
      }

      await publish('First')
      const warm = await loadPublicPage(db, 'o-gallery')
      assert.equal(warm?.record.showTitle, 'First')
      assert.equal(warm?.record.logo, '/logo.webp')
      assert.equal(warm?.record.works.length, 1)

      const stamp = await measure(() => loadPublicPage(db, 'o-gallery', Date.now() + PUBLIC_RECORD_TTL_MS + 1))
      assert.equal(stamp.value, warm)
      assert.equal(stamp.turns, 1)

      await publish('Second')
      const published = await measure(() => loadPublicPage(db, 'o-gallery'))
      assert.equal(published.value?.record.showTitle, 'Second')
      assert.equal(published.turns, 3)

      await direct`ALTER TABLE works ALTER COLUMN year TYPE varchar(40)`
      await direct`UPDATE shows SET title_en = 'Third', updated_at = now()`
      const altered = await loadPublicPage(db, 'o-gallery', Date.now() + PUBLIC_RECORD_TTL_MS + 1)
      assert.equal(altered?.record.showTitle, 'Third')
      assert.equal(altered?.record.works[0].year, '2024')
    } finally {
      await client.end({ timeout: 5 })
      await direct.end({ timeout: 5 })
      counter.close()
      fs.rmSync(mediaRoot, { recursive: true, force: true })
      await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
      await admin.end({ timeout: 5 })
    }
  },
)

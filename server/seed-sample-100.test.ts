import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { parseToman } from '../app/lib/price.ts'
import { verifySecret } from './crypto.ts'
import { MAX_WORKS } from './gallery-record.ts'
import * as seed from '../scripts/seed-sample.mjs'
import * as seed100 from '../scripts/seed-sample-100.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SEED_100 = path.join(ROOT, 'scripts/seed-sample-100.mjs')
const SEED = path.join(ROOT, 'scripts/seed-sample.mjs')

type SeedWork = {
  id: string
  artist: [string, string]
  title: [string, string]
  medium: string
  size: string
  year: string
  price: string | null
  status: string
  image: [number, number, number, string, string]
}

const WORKS: SeedWork[] = seed100.WORKS

test('the 100-work seed fills a show up to the published works limit', () => {
  assert.equal(WORKS.length, MAX_WORKS)
  assert.equal(new Set(WORKS.map((work) => work.id)).size, MAX_WORKS)
  assert.equal(new Set(WORKS.map((work) => work.title[0])).size, MAX_WORKS)
  assert.equal(new Set(WORKS.map((work) => work.title[1])).size, MAX_WORKS)
  assert.equal(new Set(WORKS.map((work) => work.image[0])).size, MAX_WORKS)
})

test('the 100-work seed reads as a survey show, not as filler', () => {
  assert.equal(new Set(WORKS.map((work) => work.artist[0])).size, 20)
  assert.equal(new Set(WORKS.map((work) => work.artist[1])).size, 20)
  for (const work of WORKS) {
    assert.ok(work.title[1].trim().length > 0, `${work.id} needs a Persian title`)
    assert.ok(work.artist[1].trim().length > 0, `${work.id} needs a Persian artist`)
  }
  assert.ok(new Set(WORKS.map((work) => work.size)).size >= 6)
  assert.ok(new Set(WORKS.map((work) => work.year)).size >= 4)
  assert.ok(WORKS.some((work) => /^[۰-۹]+$/.test(work.year)), 'some years use Persian digits')
})

test('the 100-work seed covers every status, price on request and image format', () => {
  assert.deepEqual([...new Set(WORKS.map((work) => work.status))].sort(), ['available', 'reserved', 'sold'])
  assert.ok(WORKS.some((work) => work.price === null && work.status !== 'sold'))
  assert.deepEqual([...new Set(WORKS.map((work) => work.image[4]))].sort(), ['jpeg', 'png', 'webp'])
  assert.deepEqual([...new Set(WORKS.map((work) => work.image[3]))].sort(), ['arcs', 'bands', 'blocks', 'circles'])
})

test('the 100-work seed prices parse the way the app parses them', () => {
  for (const work of WORKS) {
    assert.equal(seed.tomanFromText(work.price), parseToman(work.price), work.id)
  }
})

test('the 100-work seed keeps its work ids out of the 12-work gallery', () => {
  const twelve = new Set([...seed.WORKS, seed.REMOVED_WORK].map((work: { id: string }) => work.id))
  for (const work of WORKS) assert.equal(twelve.has(work.id), false, work.id)
  assert.notEqual(seed100.SAMPLE_100_SLUG, seed.SAMPLE_SLUG)
})

const baseUrl = process.env.SEED_TEST_DATABASE_URL || process.env.DATABASE_URL

function databaseUrl(base: string, name: string) {
  const url = new URL(base)
  url.pathname = `/${name}`
  return url.toString()
}

function runSeed(script: string, url: string, mediaDir: string, env: NodeJS.ProcessEnv = {}): string {
  return execFileSync(process.execPath, [script], {
    cwd: ROOT,
    env: { PATH: process.env.PATH, DATABASE_URL: url, MEDIA_DIR: mediaDir, PUBLIC_APP_URL: 'https://inview.test', ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

async function snapshotGallery(sql: postgres.Sql, slug: string) {
  return sql`
    SELECT g.slug, g.name_en, g.name_fa, g.status, g.is_demo, g.access_code_hash, g.logo_media_id, g.updated_at,
      (SELECT count(*) FROM works w WHERE w.gallery_id = g.id)::int AS works,
      (SELECT count(*) FROM media m WHERE m.gallery_id = g.id)::int AS media,
      (SELECT count(*) FROM shows s WHERE s.gallery_id = g.id)::int AS shows,
      (SELECT count(*) FROM leads l WHERE l.gallery_id = g.id)::int AS leads,
      (SELECT count(*) FROM visits v JOIN shows s ON s.id = v.show_id WHERE s.gallery_id = g.id)::int AS visits,
      (SELECT count(*) FROM qr_codes q JOIN shows s ON s.id = q.show_id WHERE s.gallery_id = g.id)::int AS qr_codes,
      (SELECT md5(string_agg(w.id || ':' || w.title || ':' || w.image_url, ',' ORDER BY w.id))
         FROM works w WHERE w.gallery_id = g.id) AS work_digest
    FROM galleries g WHERE g.slug = ${slug}`
}

test(
  'the 100-work seed publishes 100 works, repeats cleanly, and leaves the 12-work gallery alone',
  { skip: baseUrl ? false : 'Set SEED_TEST_DATABASE_URL or DATABASE_URL to a Postgres server.' },
  async () => {
    const name = `inview_seed100_test_${process.pid}`
    const admin = postgres(databaseUrl(String(baseUrl), 'postgres'), { max: 1, onnotice: () => {} })
    const mediaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inview-seed100-run-'))
    await admin.unsafe(`CREATE DATABASE ${name}`)
    const url = databaseUrl(String(baseUrl), name)
    const sql = postgres(url, { max: 1, onnotice: () => {} })
    try {
      execFileSync(process.execPath, ['scripts/migrate.mjs'], { cwd: ROOT, env: { PATH: process.env.PATH, DATABASE_URL: url }, stdio: 'ignore' })
      runSeed(SEED, url, mediaDir, { SAMPLE_GALLERY_ACCESS_CODE: 'twelve-work-code' })
      const twelveBefore = await snapshotGallery(sql, seed.SAMPLE_SLUG)
      assert.equal(twelveBefore[0].works, 13)

      const printed = runSeed(SEED_100, url, mediaDir).trim().split('\n')
      assert.equal(printed.length, 1)
      const match = /^SAMPLE_100_ACCESS_CODE=(\S+)$/.exec(printed[0])
      assert.ok(match, 'the first run prints the generated code once')

      const [gallery] = await sql`SELECT id, is_demo, status, logo_media_id, access_code_hash FROM galleries WHERE slug = ${seed100.SAMPLE_100_SLUG}`
      assert.equal(gallery.is_demo, true)
      assert.equal(gallery.status, 'live')
      assert.ok(gallery.logo_media_id, 'the gallery carries a logo')
      assert.ok(verifySecret(match[1], gallery.access_code_hash))

      const counts = await seed.countRows(sql, gallery.id)
      assert.equal(counts.works, MAX_WORKS)
      assert.equal(counts.show_works, MAX_WORKS)
      assert.equal(counts.media, MAX_WORKS + 1)
      assert.equal(counts.removed_works, 0)
      assert.equal(counts.shows, 1)
      assert.equal(counts.leads, 0)

      const [show] = await sql`SELECT status, title_en, starts_on, ends_on FROM shows WHERE gallery_id = ${gallery.id}`
      assert.equal(show.status, 'published')
      assert.equal(show.title_en, seed100.SHOW.titleEn)

      const [distinct] = await sql`
        SELECT count(DISTINCT image_url)::int AS images, count(DISTINCT media_id)::int AS media
        FROM works WHERE gallery_id = ${gallery.id}`
      assert.equal(distinct.images, MAX_WORKS, 'every work carries its own image')
      assert.equal(distinct.media, MAX_WORKS)

      const firstSnapshot = await snapshotGallery(sql, seed100.SAMPLE_100_SLUG)
      const repeat = runSeed(SEED_100, url, mediaDir)
      assert.equal(repeat.trim(), '')
      const secondSnapshot = await snapshotGallery(sql, seed100.SAMPLE_100_SLUG)
      assert.deepEqual(
        { ...secondSnapshot[0], updated_at: null },
        { ...firstSnapshot[0], updated_at: null },
        'a repeat run changes nothing but the stamp',
      )

      const configured = runSeed(SEED_100, url, mediaDir, { SAMPLE_100_GALLERY_ACCESS_CODE: 'hundred-work-code' })
      assert.equal(configured.trim(), '')
      assert.ok(!configured.includes('hundred-work-code'))
      const [reconfigured] = await sql`SELECT access_code_hash FROM galleries WHERE slug = ${seed100.SAMPLE_100_SLUG}`
      assert.ok(verifySecret('hundred-work-code', reconfigured.access_code_hash))

      assert.deepEqual(await snapshotGallery(sql, seed.SAMPLE_SLUG), twelveBefore)
    } finally {
      await sql.end({ timeout: 5 })
      await admin.unsafe(`DROP DATABASE IF EXISTS ${name}`)
      await admin.end({ timeout: 5 })
      fs.rmSync(mediaDir, { recursive: true, force: true })
    }
  },
)

import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const directory = new URL('../drizzle/', import.meta.url)

async function apply(client: PGlite, file: string) {
  for (const statement of readFileSync(new URL(file, directory), 'utf8').split('--> statement-breakpoint').filter((part) => part.trim())) {
    await client.exec(statement)
  }
}

async function addGallery(client: PGlite, slug: string, status: string, shows: Array<{ title: string; status: string; ageDays: number }>) {
  await client.exec(`INSERT INTO galleries (slug, name_en, name_fa, status) VALUES ('${slug}', '${slug}', '${slug}', '${status}')`)
  for (const show of shows) {
    await client.exec(
      `INSERT INTO shows (gallery_id, title_en, status, updated_at)
       SELECT id, '${show.title}', '${show.status}', now() - interval '${show.ageDays} days' FROM galleries WHERE slug = '${slug}'`,
    )
  }
}

test('migration 0008 publishes the newest draft of a live gallery and changes nothing else', async () => {
  const client = new PGlite()
  try {
    for (const file of readdirSync(directory).filter((name) => name.endsWith('.sql') && name.slice(0, 4) < '0008').sort()) {
      await apply(client, file)
    }

    await addGallery(client, 'live-drafts', 'live', [
      { title: 'older', status: 'draft', ageDays: 2 },
      { title: 'newest', status: 'draft', ageDays: 1 },
    ])
    await addGallery(client, 'live-published', 'live', [
      { title: 'current', status: 'published', ageDays: 2 },
      { title: 'next', status: 'draft', ageDays: 1 },
    ])
    await addGallery(client, 'live-archived', 'live', [{ title: 'past', status: 'archived', ageDays: 2 }])
    await addGallery(client, 'draft-gallery', 'draft', [{ title: 'only', status: 'draft', ageDays: 1 }])
    await addGallery(client, 'paused-gallery', 'paused', [{ title: 'only', status: 'draft', ageDays: 1 }])

    const before = await client.query<{ stamp: string }>("SELECT updated_at::text AS stamp FROM shows WHERE title_en = 'newest'")
    await apply(client, '0008_publish_live_shows.sql')

    const rows = await client.query<{ slug: string; title: string; status: string }>(
      `SELECT galleries.slug AS slug, shows.title_en AS title, shows.status::text AS status
       FROM shows JOIN galleries ON galleries.id = shows.gallery_id
       ORDER BY galleries.slug, shows.title_en`,
    )
    assert.deepEqual(rows.rows, [
      { slug: 'draft-gallery', title: 'only', status: 'draft' },
      { slug: 'live-archived', title: 'past', status: 'archived' },
      { slug: 'live-drafts', title: 'newest', status: 'published' },
      { slug: 'live-drafts', title: 'older', status: 'draft' },
      { slug: 'live-published', title: 'current', status: 'published' },
      { slug: 'live-published', title: 'next', status: 'draft' },
      { slug: 'paused-gallery', title: 'only', status: 'draft' },
    ])

    // The public page reports show.updated_at as its own freshness, so the one-time fix leaves it alone.
    const after = await client.query<{ stamp: string }>("SELECT updated_at::text AS stamp FROM shows WHERE title_en = 'newest'")
    assert.equal(after.rows[0].stamp, before.rows[0].stamp)
  } finally {
    await client.close()
  }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { DatabaseContext, type AppDatabase } from '../database/context'
import { createUser, createUserSession } from './accounts'
import { createTestDb } from './test-db'
import { renderStaff } from './test-render'
import { opsDictionaries } from '../app/lib/i18n-ops'
import { actionFailure } from '../app/routes/ops-session.server'
import { loader as shell } from '../app/routes/ops'
import { loader as overview } from '../app/routes/ops._index'
import NewGallery, { loader as newGallery, action as create } from '../app/routes/ops.galleries.new'
import { loader as profile, action as update } from '../app/routes/ops.galleries.profile'
import { loader as team, action as editTeam } from '../app/routes/ops.galleries.team'
import { action as signOut } from '../app/routes/ops.sign-out'
import { loader as csv } from '../app/routes/ops.galleries.leads-csv'
import { loader as inquiries } from '../app/routes/ops.inquiries'
import type { AppLoadContext } from 'react-router'

process.env.PUBLIC_APP_URL = 'http://localhost'

function actionPayload(result: Awaited<ReturnType<typeof create>>) {
  return 'data' in result ? result.data : result
}

test('each operator loader and action redirects anonymous visitors and rejects staff', async () => {
  const fixture = await createTestDb()
  const db = fixture.db as unknown as AppDatabase
  try {
    const user = await createUser(db, { email: 'staff@example.com', password: 'long-password' })
    const session = await createUserSession(db, user.id, false)
    for (const [cookie, status] of [['', 302], [session.cookie, 403]] as const) {
      const request = new Request('http://localhost/ops', { headers: { cookie } })
      const args = { request, params: { slug: 'unavailable' }, context: {} as AppLoadContext }
      for (const handler of [shell, overview, newGallery, profile, team, create, update, editTeam, signOut, csv, inquiries]) {
        await assert.rejects(DatabaseContext.run(db, () => handler(args)), (error: unknown) => {
          assert.ok(error instanceof Response)
          assert.equal(error.status, status)
          if (status === 302) assert.equal(error.headers.get('location'), '/ops/sign-in')
          return true
        })
      }
    }
  } finally { await fixture.close() }
})

test('the new gallery form shows the refusal that createGallery throws', async () => {
  const fixture = await createTestDb()
  const db = fixture.db as unknown as AppDatabase
  try {
    const user = await createUser(db, { email: 'ops@example.com', password: 'long-password', platformRole: 'admin' })
    const session = await createUserSession(db, user.id, false)
    const submit = (slug: string) => {
      const body = new URLSearchParams({ slug, nameFa: 'گالری', nameEn: 'Gallery', showTitle: 'Show', ownerIdentifier: `${slug}@example.com` })
      const request = new Request('http://localhost/ops/galleries/new', { method: 'POST', headers: { cookie: session.cookie, origin: 'http://localhost' }, body })
      return DatabaseContext.run(db, () => create({ request }))
    }
    assert.match(actionPayload(await submit('taken-slug')).invitePath ?? '', /^\/staff\/invite\//)
    for (const [slug, shown] of [['style', 'This slug matches a staff page. Select a different slug.'], ['taken-slug', 'This slug is already in use.']] as const) {
      const payload = actionPayload(await submit(slug))
      assert.equal(payload.error, true)
      assert.equal(payload.message, shown)
      const html = renderStaff(createElement(NewGallery), 'fa', '/ops/galleries/new', payload)
      assert.ok(html.includes(shown), `the form hides the refusal for ${slug}: ${html}`)
      assert.ok(!html.includes(opsDictionaries.fa.invalidFields))
    }
    const fallback = renderStaff(createElement(NewGallery), 'fa', '/ops/galleries/new', { error: true, message: null, invitePath: null, code: null, slug: null, saved: false })
    assert.ok(fallback.includes(opsDictionaries.fa.invalidFields))
  } finally { await fixture.close() }
})

test('an error that is not an AccountInputError reaches the operator as a general failure', async () => {
  let thrown: unknown
  try { actionFailure(new Error('relation "sessions" does not exist')) } catch (error) { thrown = error }
  assert.ok(thrown instanceof Response)
  assert.equal(thrown.status, 500)
  assert.equal(await thrown.text(), 'The request failed.')
})

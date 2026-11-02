import test from 'node:test'
import assert from 'node:assert/strict'
import type { AppDatabase } from '../database/context'
import { createUser, signIn } from './accounts'
import { acceptInvite, readInvite } from './invitations'
import { mailFromEnv, type Mail } from './mail'
import { requestPasswordReset } from './password-reset'
import { rateLimitConfig } from './rate-limit'
import { createTestDb } from './test-db'

const config = rateLimitConfig({ NODE_ENV: 'test' })

function inbox() {
  const mails: Mail[] = []
  return { mails, send: async (mail: Mail) => { mails.push(mail) } }
}

test('a reset email carries a one-hour link that sets a new password', async () => {
  const fixture = await createTestDb()
  const db = fixture.db as unknown as AppDatabase
  try {
    await createUser(db, { email: 'Owner@Example.com', name: 'Owner', password: 'old-long-password' })
    const { mails, send } = inbox()
    const now = new Date()
    const result = await requestPasswordReset(db, { email: ' owner@example.com ', ip: 'one', appUrl: 'https://inview.test' }, send, now, config)
    await result.delivery
    assert.equal(result.status, 'accepted')
    assert.equal(mails.length, 1)
    const token = /staff\/invite\/(\S+)/.exec(mails[0].text)?.[1]
    assert.ok(token)
    const invite = await readInvite(db, token)
    assert.equal(invite?.kind, 'reset')
    assert.equal(invite?.userName, 'Owner')
    await acceptInvite(db, token, 'Owner', 'new-long-password', false)
    const signedIn = await signIn(db, { identifier: 'owner@example.com', password: 'new-long-password', ip: 'one', secure: false })
    assert.ok(signedIn.ok)
  } finally { await fixture.close() }
})

test('an unknown email looks the same as a known one and sends nothing', async () => {
  const fixture = await createTestDb()
  const db = fixture.db as unknown as AppDatabase
  try {
    const { mails, send } = inbox()
    const result = await requestPasswordReset(db, { email: 'nobody@example.com', ip: 'one', appUrl: 'https://inview.test' }, send, new Date(), config)
    await result.delivery
    assert.equal(result.status, 'accepted')
    assert.equal(mails.length, 0)
  } finally { await fixture.close() }
})

test('reset requests stop at the account limit without telling the caller', async () => {
  const fixture = await createTestDb()
  const db = fixture.db as unknown as AppDatabase
  try {
    await createUser(db, { email: 'busy@example.com', password: 'old-long-password' })
    const { mails, send } = inbox()
    const now = new Date()
    for (let index = 0; index < 5; index++) {
      const result = await requestPasswordReset(db, { email: 'busy@example.com', ip: 'one', appUrl: 'https://inview.test' }, send, now, config)
      assert.equal(result.status, 'accepted')
      await result.delivery
    }
    assert.equal(mails.length, 3)
  } finally { await fixture.close() }
})

test('a mail provider failure does not reach the caller', async () => {
  const fixture = await createTestDb()
  const db = fixture.db as unknown as AppDatabase
  try {
    await createUser(db, { email: 'down@example.com', password: 'old-long-password' })
    const result = await requestPasswordReset(db, { email: 'down@example.com', ip: 'one', appUrl: 'https://inview.test' },
      async () => { throw new Error('provider down') }, new Date(), config)
    await result.delivery
    assert.equal(result.status, 'accepted')
  } finally { await fixture.close() }
})

test('mail stays off until the key and the sender exist', () => {
  assert.equal(mailFromEnv({ NODE_ENV: 'test' }), null)
  assert.equal(mailFromEnv({ NODE_ENV: 'test', RESEND_API_KEY: 'key' }), null)
  assert.equal(typeof mailFromEnv({ NODE_ENV: 'test', RESEND_API_KEY: 'key', MAIL_FROM: 'Inview <a@b.c>' }), 'function')
})

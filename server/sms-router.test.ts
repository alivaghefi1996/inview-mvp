import assert from 'node:assert/strict'
import test from 'node:test'
import { SmsConfigError, consoleSmsProvider, createSmsRouter, plivoSmsProvider, smsRouterFromEnv, type SmsMessage, type SmsProvider } from './sms-router'

function fakeProvider(name: string) {
  const sent: SmsMessage[] = []
  const provider: SmsProvider = { name, async send(message) { sent.push(message) } }
  return { provider, sent }
}

function fakeFetch(status = 202) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  return {
    calls,
    fetch: async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return { ok: status >= 200 && status < 300, status }
    },
  }
}

test('the router picks the longest matching prefix and falls back to the general provider', async () => {
  const general = fakeProvider('general')
  const iran = fakeProvider('iran')
  const tehran = fakeProvider('tehran')
  const router = createSmsRouter({ fallback: general.provider, routes: { '+98': iran.provider, '+98912': tehran.provider } })

  await router.send({ to: '+989121234567', text: 'a' })
  await router.send({ to: '+989351234567', text: 'b' })
  await router.send({ to: '+4915112345678', text: 'c' })

  assert.deepEqual(tehran.sent.map((message) => message.text), ['a'])
  assert.deepEqual(iran.sent.map((message) => message.text), ['b'])
  assert.deepEqual(general.sent.map((message) => message.text), ['c'])
})

test('the router refuses a destination that is not E.164', async () => {
  const general = fakeProvider('general')
  await assert.rejects(createSmsRouter({ fallback: general.provider }).send({ to: '09121234567', text: 'a' }))
  assert.equal(general.sent.length, 0)
})

test('the Plivo provider posts src, dst and text with basic auth', async () => {
  const { calls, fetch } = fakeFetch()
  await plivoSmsProvider({ authId: 'MA123', authToken: 'secret', src: 'Inview', fetch }).send({ to: '+4915112345678', text: 'hello' })
  assert.equal(calls[0].url, 'https://api.plivo.com/v1/Account/MA123/Message/')
  assert.equal(calls[0].init.method, 'POST')
  const headers = calls[0].init.headers as Record<string, string>
  assert.equal(headers.Authorization, `Basic ${Buffer.from('MA123:secret').toString('base64')}`)
  assert.equal(headers['Content-Type'], 'application/json')
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { src: 'Inview', dst: '+4915112345678', text: 'hello' })
})

test('a Plivo failure names the status and hides the message', async () => {
  const { fetch } = fakeFetch(401)
  await assert.rejects(
    plivoSmsProvider({ authId: 'MA123', authToken: 'secret', src: 'Inview', fetch }).send({ to: '+4915112345678', text: 'code 1234' }),
    (error: Error) => error.message === 'Plivo SMS failed with status 401.',
  )
})

test('env config routes through Plivo and keeps route overrides', async () => {
  const { calls, fetch } = fakeFetch()
  const iran = fakeProvider('iran')
  const router = smsRouterFromEnv(
    { NODE_ENV: 'production', PLIVO_AUTH_ID: 'MA123', PLIVO_AUTH_TOKEN: 'secret', PLIVO_SRC: 'Inview' },
    { '+98': iran.provider },
    fetch,
  )
  await router.send({ to: '+989121234567', text: 'a' })
  await router.send({ to: '+14155552671', text: 'b' })
  assert.equal(iran.sent.length, 1)
  assert.equal(calls.length, 1)
  assert.equal(router.providerFor('+14155552671').name, 'plivo')
})

test('production without Plivo config fails closed', () => {
  assert.throws(() => smsRouterFromEnv({ NODE_ENV: 'production' }), SmsConfigError)
  assert.throws(() => smsRouterFromEnv({ NODE_ENV: 'production', PLIVO_AUTH_ID: 'MA123' }), SmsConfigError)
})

test('development without Plivo config uses the console provider', () => {
  assert.equal(smsRouterFromEnv({ NODE_ENV: 'development' }).providerFor('+14155552671').name, 'console')
})

test('the console provider logs in development and refuses to run in production', async () => {
  const lines: string[] = []
  const provider = consoleSmsProvider((line) => lines.push(line))
  const previous = process.env.NODE_ENV
  try {
    process.env.NODE_ENV = 'development'
    await provider.send({ to: '+14155552671', text: 'hello' })
    assert.equal(lines.length, 1)
    process.env.NODE_ENV = 'production'
    await assert.rejects(provider.send({ to: '+14155552671', text: 'code 1234' }), SmsConfigError)
    assert.equal(lines.length, 1)
  } finally {
    process.env.NODE_ENV = previous
  }
})

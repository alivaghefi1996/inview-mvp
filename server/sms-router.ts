import { isE164 } from '../app/lib/phone'

export type SmsMessage = { to: string; text: string }

export interface SmsProvider {
  readonly name: string
  send(message: SmsMessage): Promise<void>
}

type FetchLike = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status'>>

const PLIVO_TIMEOUT_MS = 10_000

export class SmsConfigError extends Error {}

export function consoleSmsProvider(log: (line: string) => void = console.info): SmsProvider {
  return {
    name: 'console',
    async send({ to, text }) {
      if (process.env.NODE_ENV === 'production') throw new SmsConfigError('The console SMS provider cannot run in production.')
      log(`[sms:console] to=${to} text=${text}`)
    },
  }
}

export function plivoSmsProvider(config: {
  authId: string
  authToken: string
  src: string
  fetch?: FetchLike
}): SmsProvider {
  const send = config.fetch ?? fetch
  const url = `https://api.plivo.com/v1/Account/${encodeURIComponent(config.authId)}/Message/`
  const authorization = `Basic ${Buffer.from(`${config.authId}:${config.authToken}`).toString('base64')}`
  return {
    name: 'plivo',
    async send({ to, text }) {
      const response = await send(url, {
        method: 'POST',
        headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({ src: config.src, dst: to, text }),
        signal: AbortSignal.timeout(PLIVO_TIMEOUT_MS),
      })
      if (!response.ok) throw new Error(`Plivo SMS failed with status ${response.status}.`)
    },
  }
}

export function createSmsRouter(config: {
  fallback: SmsProvider
  routes?: Readonly<Record<string, SmsProvider>>
}): SmsProvider & { providerFor(to: string): SmsProvider } {
  const routes = Object.entries(config.routes ?? {}).sort(([a], [b]) => b.length - a.length)
  const providerFor = (to: string) => routes.find(([prefix]) => to.startsWith(prefix))?.[1] ?? config.fallback
  return {
    name: 'router',
    providerFor,
    async send(message) {
      if (!isE164(message.to)) throw new Error('The SMS destination must be an E.164 number.')
      await providerFor(message.to).send(message)
    },
  }
}

export function smsRouterFromEnv(
  env: Record<string, string | undefined> = process.env,
  routes?: Readonly<Record<string, SmsProvider>>,
  fetchImpl?: FetchLike,
) {
  const { PLIVO_AUTH_ID: authId, PLIVO_AUTH_TOKEN: authToken, PLIVO_SRC: src } = env
  if (authId && authToken && src) {
    return createSmsRouter({ fallback: plivoSmsProvider({ authId, authToken, src, fetch: fetchImpl }), routes })
  }
  if (env.NODE_ENV === 'production') {
    throw new SmsConfigError('Set PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN and PLIVO_SRC before SMS can run in production.')
  }
  return createSmsRouter({ fallback: consoleSmsProvider(), routes })
}

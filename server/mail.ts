export type Mail = { to: string; subject: string; text: string }
export type SendMail = (mail: Mail) => Promise<void>

const RESEND_URL = 'https://api.resend.com/emails'
const SEND_TIMEOUT_MS = 10_000

export function mailFromEnv(env: NodeJS.ProcessEnv = process.env, fetchImpl: typeof fetch = fetch): SendMail | null {
  const key = env.RESEND_API_KEY?.trim()
  const from = env.MAIL_FROM?.trim()
  if (!key || !from) return null
  return async ({ to, subject, text }) => {
    const response = await fetchImpl(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'User-Agent': 'inview-mvp' },
      body: JSON.stringify({ from, to: [to], subject, text }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`Mail provider returned ${response.status}`)
  }
}

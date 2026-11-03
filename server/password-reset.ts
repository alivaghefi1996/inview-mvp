import { sql } from 'drizzle-orm'
import { users } from '../database/schema'
import type { AccountDb } from './accounts'
import { sha256 } from './crypto'
import { createInvite } from './invitations'
import type { SendMail } from './mail'
import { consumeBucket, hashClientAddress, rateLimitConfig } from './rate-limit'
import type { AppDatabase } from '../database/context'

const RESET_TTL_MS = 60 * 60 * 1000
const WINDOW_SEC = 60 * 60
const IP_MAX = 10
const ACCOUNT_MAX = 3

function resetMail(to: string, link: string) {
  return {
    to,
    subject: 'بازنشانی رمز عبور اینویو / Reset your Inview password',
    text: [
      'برای انتخاب رمز عبور تازه این پیوند را باز کنید. پیوند تا یک ساعت کار می‌کند.',
      link,
      '',
      'Open this link to choose a new password. The link works for one hour.',
      link,
      '',
      'اگر این درخواست از شما نیست، این ایمیل را نادیده بگیرید.',
      'If you did not ask for this, ignore this email.',
    ].join('\n'),
  }
}

async function deliverReset(db: AppDatabase, email: string, appUrl: string, send: SendMail) {
  const [user] = await db.select({ id: users.id, email: users.email, status: users.status }).from(users)
    .where(sql`lower(${users.email}) = ${email}`).limit(1)
  if (!user?.email || user.status !== 'active') return
  const invite = await createInvite(db as AccountDb, { kind: 'reset', userId: user.id, ttlMs: RESET_TTL_MS })
  await send(resetMail(user.email, `${appUrl}/staff/invite/${encodeURIComponent(invite.token)}`))
}

export async function requestPasswordReset(
  db: AppDatabase,
  input: { email: string; ip: string; appUrl: string },
  send: SendMail,
  now = new Date(),
  config = rateLimitConfig(),
): Promise<{ status: 'limited' | 'accepted'; delivery: Promise<void> }> {
  const email = input.email.trim().toLowerCase()
  const clientKey = `password-reset:ip:${hashClientAddress(input.ip, now, config.ipSalt)}`
  const client = await consumeBucket(db, clientKey, IP_MAX, WINDOW_SEC, now)
  if (!client.allowed) return { status: 'limited', delivery: Promise.resolve() }
  if (!email.includes('@') || email.length > 320) return { status: 'accepted', delivery: Promise.resolve() }
  const account = await consumeBucket(db, `password-reset:account:${sha256(email)}`, ACCOUNT_MAX, WINDOW_SEC, now)
  if (!account.allowed) return { status: 'accepted', delivery: Promise.resolve() }
  const delivery = deliverReset(db, email, input.appUrl, send).catch((error: unknown) => {
    console.error('Password reset delivery failed:', error instanceof Error ? error.message : 'unknown')
  })
  return { status: 'accepted', delivery }
}

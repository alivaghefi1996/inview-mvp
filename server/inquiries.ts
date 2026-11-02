import { and, desc, eq, inArray, isNull, lte, sql } from 'drizzle-orm'
import type { AppDatabase } from '../database/context'
import { inquiries } from '../database/schema'
import { INQUIRY_CONSENT_VERSION } from '../app/lib/consent'
import { normalizePhone } from './accounts'
import { logEvent } from './http-log.js'
import type { Principal } from './authz'
import { requireOperator } from './ops'
import { maskPhone } from './ops-data'
import { consumeBucket, hashClientAddress, rateLimitConfig, tooMany, type ApiResult } from './rate-limit'

const FIELD_LIMIT = 200
const CONTACT_LIMIT = 320
const MESSAGE_LIMIT = 4000
const LIST_LIMIT = 200
const PASS_LIMIT = 20
const REQUEST_TIMEOUT_MS = 15_000
const CLAIM_LEASE_MS = 120_000
const RETRY_BASE_MS = 60_000
const RETRY_CAP_MS = 3_600_000
const RETRY_TICK_MS = 30_000

const INVALID_FIELDS = {
  status: 400,
  body: { error: 'Fill in each field and accept the consent line.', errorFa: 'همه بخش‌ها را پر کنید و متن رضایت را بپذیرید.' },
}
const INVALID_CONTACT = {
  status: 400,
  body: { error: 'Enter a valid phone number or email address.', errorFa: 'یک شماره تلفن یا ایمیل معتبر وارد کنید.' },
}
const INVALID_CONSENT_VERSION = {
  status: 400,
  body: { error: 'The consent text version is not valid.', errorFa: 'نسخه متن رضایت معتبر نیست. صفحه را دوباره باز کنید.' },
}

type InquiryRow = typeof inquiries.$inferSelect
type FetchImpl = typeof fetch

type PaperclipConfig = {
  apiUrl: string
  companyId: string
  projectId: string
  assigneeUserId: string
  token: string
}

type DeliveryOptions = {
  env?: NodeJS.ProcessEnv
  fetchImpl?: FetchImpl
  clock?: () => Date
}

class DeliveryError extends Error {}

function textField(value: unknown, limit: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed && trimmed.length <= limit ? trimmed : null
}

export function normalizeContact(value: unknown): string | null {
  const raw = textField(value, CONTACT_LIMIT)
  if (!raw) return null
  if (raw.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : null
  const phone = normalizePhone(raw).replace(/[\s()-]/g, '')
  return /^\+?\d{7,15}$/.test(phone) ? phone : null
}

export async function submitInquiry(
  db: AppDatabase,
  body: unknown,
  ip: string,
  now = new Date(),
  config = rateLimitConfig(),
): Promise<ApiResult> {
  const payload = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const galleryName = textField(payload.galleryName, FIELD_LIMIT)
  const contactPerson = textField(payload.contactPerson, FIELD_LIMIT)
  const message = textField(payload.message, MESSAGE_LIMIT)
  if (!galleryName || !contactPerson || !message || payload.consent !== true) return INVALID_FIELDS
  if (payload.consentTextVersion !== INQUIRY_CONSENT_VERSION) return INVALID_CONSENT_VERSION
  const contact = normalizeContact(payload.contact)
  if (!contact) return INVALID_CONTACT
  const bucket = `inquiry:ip:${hashClientAddress(ip, now, config.ipSalt)}`
  const outcome = await consumeBucket(db, bucket, config.inquiryIpMax, config.inquiryIpWindowSec, now)
  if (!outcome.allowed) return tooMany(outcome.retryAfterSeconds)
  await db.insert(inquiries).values({
    galleryName,
    contactPerson,
    contact,
    message,
    lang: payload.lang === 'en' ? 'en' : 'fa',
    consentAt: now,
    consentTextVersion: INQUIRY_CONSENT_VERSION,
    nextAttemptAt: now,
  })
  return { status: 201, body: { ok: true } }
}

export function paperclipConfig(env: NodeJS.ProcessEnv = process.env): PaperclipConfig | null {
  const apiUrl = env.PAPERCLIP_API_URL?.trim()
  const companyId = env.PAPERCLIP_COMPANY_ID?.trim()
  const projectId = env.PAPERCLIP_PROJECT_ID?.trim()
  const assigneeUserId = env.PAPERCLIP_INQUIRY_ASSIGNEE_USER_ID?.trim()
  const token = env.PAPERCLIP_API_TOKEN?.trim()
  if (!apiUrl || !companyId || !projectId || !assigneeUserId || !token) return null
  return { apiUrl: apiUrl.replace(/\/+$/, ''), companyId, projectId, assigneeUserId, token }
}

function issueTitle(row: InquiryRow) {
  return `Gallery inquiry: ${row.galleryName.replace(/\s+/g, ' ')}`.slice(0, 200)
}

function issueDescription(row: InquiryRow) {
  return [
    `**Gallery:** ${row.galleryName}`,
    `**Contact person:** ${row.contactPerson}`,
    `**Phone or email:** ${row.contact}`,
    `**Language:** ${row.lang}`,
    `**Received:** ${row.createdAt.toISOString()}`,
    '',
    '**Message:**',
    '',
    row.message,
    '',
    `Inquiry id: ${row.id}`,
  ].join('\n')
}

function retryDelayMs(attempts: number) {
  return Math.min(RETRY_BASE_MS * 2 ** Math.min(Math.max(attempts - 1, 0), 12), RETRY_CAP_MS)
}

function safeError(error: unknown) {
  if (error instanceof DeliveryError) return error.message
  if (!(error instanceof Error)) return 'Request failed'
  const code = (error.cause as { code?: unknown } | undefined)?.code
  return typeof code === 'string' ? `${error.name}: ${code}` : error.name
}

async function createIssue(config: PaperclipConfig, row: InquiryRow, fetchImpl: FetchImpl) {
  const response = await fetchImpl(`${config.apiUrl}/api/companies/${encodeURIComponent(config.companyId)}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'inview-inquiry-form',
    },
    body: JSON.stringify({
      projectId: config.projectId,
      title: issueTitle(row),
      description: issueDescription(row),
      status: 'todo',
      priority: 'high',
      assigneeUserId: config.assigneeUserId,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new DeliveryError(`HTTP ${response.status}`)
  const issue = await response.json() as { id?: unknown; identifier?: unknown }
  if (typeof issue.id !== 'string' || !issue.id) throw new DeliveryError('Response has no issue id')
  return { id: issue.id, identifier: typeof issue.identifier === 'string' ? issue.identifier : null }
}

async function claimNext(db: AppDatabase, now: Date): Promise<InquiryRow | undefined> {
  const due = db.select({ id: inquiries.id }).from(inquiries)
    .where(and(isNull(inquiries.paperclipIssueId), lte(inquiries.nextAttemptAt, now)))
    .orderBy(inquiries.nextAttemptAt, inquiries.id)
    .limit(1)
    .for('update', { skipLocked: true })
  const [row] = await db.update(inquiries)
    .set({ attempts: sql`${inquiries.attempts} + 1`, nextAttemptAt: new Date(now.getTime() + CLAIM_LEASE_MS) })
    .where(inArray(inquiries.id, due))
    .returning()
  return row
}

export async function deliverPendingInquiries(db: AppDatabase, options: DeliveryOptions = {}) {
  const outcome = { delivered: 0, failed: 0 }
  const config = paperclipConfig(options.env ?? process.env)
  if (!config) return outcome
  const fetchImpl = options.fetchImpl ?? fetch
  const clock = options.clock ?? (() => new Date())
  for (let pass = 0; pass < PASS_LIMIT; pass += 1) {
    const row = await claimNext(db, clock())
    if (!row) break
    try {
      const issue = await createIssue(config, row, fetchImpl)
      await db.update(inquiries)
        .set({ paperclipIssueId: issue.id, paperclipIssueIdentifier: issue.identifier, lastError: null })
        .where(and(eq(inquiries.id, row.id), isNull(inquiries.paperclipIssueId)))
      outcome.delivered += 1
    } catch (error) {
      const lastError = safeError(error)
      await db.update(inquiries)
        .set({ lastError, nextAttemptAt: new Date(clock().getTime() + retryDelayMs(row.attempts)) })
        .where(and(eq(inquiries.id, row.id), isNull(inquiries.paperclipIssueId)))
      logEvent('warn', 'inquiry-delivery-failed', { inquiry: row.id, attempts: row.attempts, error: lastError })
      outcome.failed += 1
      break
    }
  }
  return outcome
}

export function deliverInBackground(db: AppDatabase, options: DeliveryOptions = {}) {
  return deliverPendingInquiries(db, options).catch((error: unknown) => {
    logEvent('error', 'inquiry-delivery-pass-failed', { error: safeError(error) })
  })
}

export function startInquiryRetry(db: AppDatabase, options: DeliveryOptions = {}, tickMs = RETRY_TICK_MS) {
  let running = false
  const timer = setInterval(() => {
    if (running) return
    running = true
    void deliverInBackground(db, options).finally(() => {
      running = false
    })
  }, tickMs)
  timer.unref()
  return () => clearInterval(timer)
}

function issueUrl(identifier: string | null, env: NodeJS.ProcessEnv) {
  const base = env.PAPERCLIP_API_URL?.trim().replace(/\/+$/, '')
  if (!base || !identifier || !/^[A-Z0-9]+-\d+$/.test(identifier)) return null
  return `${base}/${identifier.split('-')[0]}/issues/${identifier}`
}

export async function listInquiries(db: AppDatabase, principal: Principal | null, env: NodeJS.ProcessEnv = process.env) {
  const actor = requireOperator(principal)
  const rows = await db.select({
    id: inquiries.id,
    galleryName: inquiries.galleryName,
    contactPerson: inquiries.contactPerson,
    contact: inquiries.contact,
    message: inquiries.message,
    lang: inquiries.lang,
    consentTextVersion: inquiries.consentTextVersion,
    createdAt: inquiries.createdAt,
    issueId: inquiries.paperclipIssueId,
    identifier: inquiries.paperclipIssueIdentifier,
    attempts: inquiries.attempts,
    lastError: inquiries.lastError,
  }).from(inquiries).orderBy(desc(inquiries.createdAt), desc(inquiries.id)).limit(LIST_LIMIT)
  return rows.map(({ issueId, ...row }) => ({
    ...row,
    contact: actor.platformRole === 'support' ? maskPhone(row.contact) : row.contact,
    state: issueId ? 'created' as const : 'pending' as const,
    taskUrl: issueUrl(row.identifier, env),
  }))
}

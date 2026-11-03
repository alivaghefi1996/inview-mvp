import { and, asc, count, desc, eq, gte, isNull, sql } from 'drizzle-orm'
import { INVALID_PHONE_CODE, canonicalPhone, isE164 } from '../app/lib/phone'
import { mobilePhone } from './phone'
/** Drizzle database handle (Postgres.js in production, PGlite in tests). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any
import {
  galleries,
  leads,
  media,
  qrCodes,
  showWorks,
  shows,
  visits,
  works,
} from '../database/schema'
import { CONSENT_STALE_CODE, CONSENT_TEXT_VERSION } from '../app/lib/consent'
import { localDigits } from '../app/lib/format'
import { parseToman } from '../app/lib/price'
import {
  GALLERY_TIME_ZONE,
  QR_CODE_PATTERN,
  tehranDay,
  tehranGregorianStamp,
  tehranJalaliStamp,
} from '../app/lib/tehran-day'
import { verifySecret } from './crypto'
import { displayVariant } from './images'
import type { ObjectStorage } from './storage'

const SAMPLE_RE = /sample|نمونه/i

export interface WorkImageSet {
  webp: string
  jpeg: string
}

export interface GalleryWorkDto {
  id: string
  artist: string
  artistFa: string
  title: string
  titleFa: string
  medium: string
  mediumFa: string
  size: string
  year: string
  price: number | null
  status: 'available' | 'reserved' | 'sold'
  image: string
  imageSet?: WorkImageSet | null
  sample: boolean
}

export interface GalleryRecordDto {
  slug: string
  demo: boolean
  name: string
  nameFa: string
  logo: string | null
  showTitle: string
  showTitleFa: string
  dates: string
  datesFa: string
  hours: string
  hoursFa: string
  address: string
  addressFa: string
  text: string
  textFa: string
  pdfUrl: string | null
  startsOn: string | null
  endsOn: string | null
  works: GalleryWorkDto[]
  updatedAt?: string
}

export interface StaffLeadDto {
  phone: string
  kind: 'save' | 'ask'
  at: string
  workId: string | null
  workTitle: string | null
  consentTextVersion: string
  verified: false
}

export interface StaffDayDto {
  day: string
  scans: number
  views: number
}

export interface StaffWorkDto {
  workId: string
  title: string
  views: number
  saves: number
  asks: number
}

export interface GalleryStateDto {
  record: GalleryRecordDto
  visits: { scans: number; views: number }
  days: StaffDayDto[]
  works: StaffWorkDto[]
  leads: StaffLeadDto[]
}

export type GalleryTenant = {
  gallery: typeof galleries.$inferSelect
  show: typeof shows.$inferSelect
}

export const GALLERY_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/

export function isDemoGallery(gallery: Pick<GalleryTenant['gallery'], 'isDemo'>): boolean {
  return gallery.isDemo
}

/** `tenantBySlug` and `tenantById` return a draft show too, because staff edit it. Public paths need this check. */
export function isPublicTenant(tenant: GalleryTenant | null | undefined): tenant is GalleryTenant {
  return !!tenant && tenant.gallery.status === 'live' && tenant.show.status === 'published'
}

export const GALLERY_NOT_FOUND = { status: 404, body: { error: 'That gallery was not found.', errorFa: 'گالری پیدا نشد.' } }

export function galleryNotFound(): Response {
  return Response.json(GALLERY_NOT_FOUND.body, { status: 404, headers: { 'Cache-Control': 'no-store' } })
}

export async function tenantBySlug(db: Db, slug: string): Promise<GalleryTenant | null> {
  if (!GALLERY_SLUG_PATTERN.test(slug)) return null
  const [gallery] = await db.select().from(galleries).where(eq(galleries.slug, slug)).limit(1)
  if (!gallery) return null
  return withLatestShow(db, gallery)
}

export async function tenantById(db: Db, galleryId: string): Promise<GalleryTenant | null> {
  const [gallery] = await db.select().from(galleries).where(eq(galleries.id, galleryId)).limit(1)
  if (!gallery) return null
  return withLatestShow(db, gallery)
}

async function withLatestShow(db: Db, gallery: typeof galleries.$inferSelect): Promise<GalleryTenant | null> {
  const [show] = await db
    .select()
    .from(shows)
    .where(eq(shows.galleryId, gallery.id))
    .orderBy(sql`${shows.status} = 'published' DESC`, sql`${shows.status} = 'draft' DESC`, desc(shows.updatedAt))
    .limit(1)
  if (!show) return null
  return { gallery, show }
}

export const REPORT_TIME_ZONE = GALLERY_TIME_ZONE
const REPORT_DAYS = 30

export function tehranDate(at: Date): string {
  return tehranDay(at)
}

function text(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

async function logoUrl(db: Db, galleryId: string, logoMediaId: string | null): Promise<string | null> {
  if (!logoMediaId) return null
  const [row] = await db
    .select()
    .from(media)
    .where(and(eq(media.id, logoMediaId), eq(media.galleryId, galleryId)))
    .limit(1)
    .prepare('gallery_logo')
    .execute()
  if (!row) return null
  return displayVariant(row.variants)
}

const VARIANT_NAME = /\/w(\d+)\.(webp|jpeg)$/

function srcsetOf(entries: Array<[number, string]>): string {
  return entries
    .sort((a, b) => a[0] - b[0])
    .map(([width, url]) => `${url} ${width}w`)
    .join(', ')
}

export function imageSetFor(image: string, variants: Record<string, string> | null | undefined): WorkImageSet | null {
  if (!image) return null
  const webp: Array<[number, string]> = []
  const jpeg: Array<[number, string]> = []
  if (variants && Object.keys(variants).length > 0) {
    for (const [name, url] of Object.entries(variants)) {
      const match = /^w(\d+)\.(webp|jpeg)$/.exec(name)
      if (!match) continue
      ;(match[2] === 'webp' ? webp : jpeg).push([Number(match[1]), url])
    }
  } else {
    const match = VARIANT_NAME.exec(image)
    if (!match) return null
    const base = image.slice(0, match.index)
    const own = Number(match[1])
    for (const width of new Set([...[320, 640, 1280].filter((value) => value < own), own])) {
      webp.push([width, `${base}/w${width}.webp`])
      jpeg.push([width, `${base}/w${width}.jpeg`])
    }
  }
  if (webp.length === 0 && jpeg.length === 0) return null
  return { webp: srcsetOf(webp), jpeg: srcsetOf(jpeg) }
}

async function readRecord(
  db: Db,
  gallery: GalleryTenant['gallery'],
  show: {
    titleEn: string
    titleFa: string
    datesEn: string
    datesFa: string
    hoursEn: string
    hoursFa: string
    addressEn: string
    addressFa: string
    textEn: string
    textFa: string
    pdfUrl: string | null
    startsOn?: string | null
    endsOn?: string | null
    updatedAt: Date
    id: string
  },
): Promise<GalleryRecordDto> {
  const linked = await db
    .select({
      work: works,
      variants: media.variants,
    })
    .from(showWorks)
    .innerJoin(works, eq(showWorks.workId, works.id))
    .leftJoin(media, and(eq(works.mediaId, media.id), eq(media.galleryId, gallery.id)))
    .where(and(eq(showWorks.showId, show.id), eq(works.galleryId, gallery.id)))
    .orderBy(asc(showWorks.sortOrder))
    .prepare('record_works')
    .execute()

  const workDtos: GalleryWorkDto[] = linked.map(
    (row: { work: typeof works.$inferSelect; variants: Record<string, string> | null }) => ({
      id: row.work.id,
      artist: row.work.artist,
      artistFa: row.work.artistFa,
      title: row.work.title,
      titleFa: row.work.titleFa,
      medium: row.work.medium,
      mediumFa: row.work.mediumFa,
      size: row.work.size,
      year: row.work.year,
      price: row.work.priceToman,
      status: row.work.status,
      image: row.work.imageUrl || '',
      imageSet: imageSetFor(row.work.imageUrl || '', row.variants),
      sample: row.work.sample,
    }),
  )

  return {
    slug: gallery.slug,
    demo: isDemoGallery(gallery),
    name: gallery.nameEn,
    nameFa: gallery.nameFa,
    logo: await logoUrl(db, gallery.id, gallery.logoMediaId),
    showTitle: show.titleEn,
    showTitleFa: show.titleFa,
    dates: show.datesEn,
    datesFa: show.datesFa,
    hours: show.hoursEn,
    hoursFa: show.hoursFa,
    address: show.addressEn,
    addressFa: show.addressFa,
    text: show.textEn,
    textFa: show.textFa,
    pdfUrl: show.pdfUrl,
    startsOn: show.startsOn ?? null,
    endsOn: show.endsOn ?? null,
    works: workDtos,
    updatedAt: show.updatedAt.toISOString(),
  }
}

async function readVisitCounts(db: Db, showId: string): Promise<GalleryStateDto['visits']> {
  const [scanRow] = await db
    .select({ value: count() })
    .from(visits)
    .where(and(eq(visits.showId, showId), eq(visits.kind, 'scan')))
  const [viewRow] = await db
    .select({ value: count() })
    .from(visits)
    .where(and(eq(visits.showId, showId), eq(visits.kind, 'view')))
  return { scans: Number(scanRow?.value || 0), views: Number(viewRow?.value || 0) }
}

async function readLeadList(db: Db, galleryId: string, showId: string, limit = 200): Promise<StaffLeadDto[]> {
  const rows = await db
    .select({ lead: leads, workTitle: works.title })
    .from(leads)
    .leftJoin(works, and(eq(leads.workId, works.id), eq(works.galleryId, galleryId)))
    .where(and(eq(leads.galleryId, galleryId), eq(leads.showId, showId)))
    .orderBy(desc(leads.createdAt))
    .limit(limit)
  return rows.map((row: { lead: typeof leads.$inferSelect; workTitle: string | null }) => ({
    phone: canonicalPhone(row.lead.phone),
    kind: row.lead.kind,
    at: row.lead.consentAt.toISOString(),
    workId: row.lead.workId,
    workTitle: row.workTitle,
    consentTextVersion: row.lead.consentTextVersion,
    verified: false as const,
  }))
}

/** An archived show has no recent days, so its table lists its whole run. */
async function readDays(db: Db, showId: string, wholeRun: boolean, now = new Date()): Promise<StaffDayDto[]> {
  const since = new Date(wholeRun ? 0 : now.getTime() - REPORT_DAYS * 24 * 60 * 60 * 1000)
  const rows = await db
    .select({ kind: visits.kind, createdAt: visits.createdAt })
    .from(visits)
    .where(and(eq(visits.showId, showId), gte(visits.createdAt, since)))
  const byDay = new Map<string, StaffDayDto>()
  for (const row of rows as Array<{ kind: 'scan' | 'view'; createdAt: Date }>) {
    const day = tehranDate(new Date(row.createdAt))
    const entry = byDay.get(day) ?? { day, scans: 0, views: 0 }
    if (row.kind === 'scan') entry.scans += 1
    else entry.views += 1
    byDay.set(day, entry)
  }
  return [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : -1))
}

async function readWorkStats(db: Db, galleryId: string, showId: string): Promise<StaffWorkDto[]> {
  const workRows = await db
    .select({ id: works.id, title: works.title })
    .from(works)
    .where(eq(works.galleryId, galleryId))
  const viewRows = await db
    .select({ workId: visits.workId, value: count() })
    .from(visits)
    .where(and(eq(visits.showId, showId), eq(visits.kind, 'view')))
    .groupBy(visits.workId)
  const leadRows = await db
    .select({ workId: leads.workId, kind: leads.kind, value: count() })
    .from(leads)
    .where(and(eq(leads.galleryId, galleryId), eq(leads.showId, showId)))
    .groupBy(leads.workId, leads.kind)
  const stats = new Map<string, StaffWorkDto>()
  for (const row of workRows as Array<{ id: string; title: string }>) {
    stats.set(row.id, { workId: row.id, title: row.title, views: 0, saves: 0, asks: 0 })
  }
  for (const row of viewRows as Array<{ workId: string | null; value: number }>) {
    const entry = row.workId ? stats.get(row.workId) : undefined
    if (entry) entry.views = Number(row.value)
  }
  for (const row of leadRows as Array<{ workId: string | null; kind: 'save' | 'ask'; value: number }>) {
    const entry = row.workId ? stats.get(row.workId) : undefined
    if (!entry) continue
    if (row.kind === 'save') entry.saves = Number(row.value)
    else entry.asks = Number(row.value)
  }
  return [...stats.values()]
    .filter((entry) => entry.views + entry.saves + entry.asks > 0)
    .sort((a, b) => b.views + b.saves + b.asks - (a.views + a.saves + a.asks))
}

export type PublicPage = { record: GalleryRecordDto }

type CachedPage = { stamp: string; checkedAt: number; value: PublicPage }

type PublicPageCache = {
  generation: number
  entries: Map<string, CachedPage>
  pending: Map<string, Promise<PublicPage | null>>
}

export const PUBLIC_RECORD_TTL_MS = 5_000

const publicRecordCache = new WeakMap<object, PublicPageCache>()

function ttlMs(): number {
  const raw = process.env.PUBLIC_RECORD_TTL_MS
  if (raw === undefined || raw.trim() === '') return PUBLIC_RECORD_TTL_MS
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : PUBLIC_RECORD_TTL_MS
}

function cacheFor(db: Db): PublicPageCache {
  let store = publicRecordCache.get(db)
  if (!store) {
    store = { generation: 0, entries: new Map(), pending: new Map() }
    publicRecordCache.set(db, store)
  }
  return store
}

export function clearPublicRecordCache(db: Db) {
  const store = cacheFor(db)
  store.generation += 1
  store.entries.clear()
}

async function publicTenantBySlug(db: Db, slug: string): Promise<GalleryTenant | null> {
  if (!GALLERY_SLUG_PATTERN.test(slug)) return null
  const [row] = await db
    .select({ gallery: galleries, show: shows })
    .from(galleries)
    .innerJoin(shows, eq(shows.galleryId, galleries.id))
    .where(and(eq(galleries.slug, slug), eq(shows.status, 'published')))
    .orderBy(desc(shows.updatedAt))
    .limit(1)
    .prepare('public_tenant_by_slug')
    .execute()
  if (!row) return null
  return { gallery: row.gallery, show: row.show }
}

function stampOf(tenant: GalleryTenant): string {
  const gallery = new Date(tenant.gallery.updatedAt).getTime()
  const show = new Date(tenant.show.updatedAt).getTime()
  return `${tenant.show.id}:${gallery}:${show}`
}

async function readPublicPage(
  db: Db,
  store: PublicPageCache,
  slug: string,
  now: number,
): Promise<PublicPage | null> {
  const generation = store.generation
  const tenant = await publicTenantBySlug(db, slug)
  if (!tenant || tenant.gallery.status !== 'live') {
    store.entries.delete(slug)
    return null
  }
  const stamp = stampOf(tenant)
  const cached = store.entries.get(slug)
  if (cached && cached.stamp === stamp) {
    cached.checkedAt = now
    return cached.value
  }
  const value: PublicPage = { record: await readRecord(db, tenant.gallery, tenant.show) }
  if (store.generation === generation) store.entries.set(slug, { stamp, checkedAt: now, value })
  return value
}

/** A live gallery between two shows. Its printed QR codes land on a message and not on a 404. */
export async function galleryBetweenShows(db: Db, slug: string): Promise<{ nameEn: string; nameFa: string } | null> {
  if (!GALLERY_SLUG_PATTERN.test(slug)) return null
  const [row] = await db
    .select({ nameEn: galleries.nameEn, nameFa: galleries.nameFa })
    .from(galleries)
    .innerJoin(shows, eq(shows.galleryId, galleries.id))
    .where(and(eq(galleries.slug, slug), eq(galleries.status, 'live'), eq(shows.status, 'archived')))
    .limit(1)
  return row ?? null
}

/** Public catalogue only. This function does not read visits or leads. */
export function loadPublicPage(db: Db, slug: string, now: number = Date.now()): Promise<PublicPage | null> {
  const store = cacheFor(db)
  const cached = store.entries.get(slug)
  if (cached && now - cached.checkedAt < ttlMs()) return Promise.resolve(cached.value)
  const started = store.pending.get(slug)
  if (started) return started
  const pending = readPublicPage(db, store, slug, now).finally(() => {
    store.pending.delete(slug)
  })
  store.pending.set(slug, pending)
  return pending
}

export async function loadPublicRecord(
  db: Db,
  tenant: GalleryTenant,
  now: number = Date.now(),
): Promise<PublicPage> {
  const page = await loadPublicPage(db, tenant.gallery.slug, now)
  if (!page) throw galleryNotFound()
  return page
}

export async function loadStaffRecord(db: Db, tenant: GalleryTenant): Promise<{ record: GalleryRecordDto }> {
  return { record: await readRecord(db, tenant.gallery, tenant.show) }
}

type StaffReportBody = Omit<GalleryStateDto, 'record'>

type StaffReportResult =
  | { status: 200; body: StaffReportBody }
  | { status: 401 | 404; body: { error: string } }

const SHOW_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Without `showId`, the tenant keeps its current show. A show of another gallery resolves to null. */
export async function tenantWithShow(db: Db, tenant: GalleryTenant, showId?: string | null): Promise<GalleryTenant | null> {
  if (!showId) return tenant
  if (!SHOW_ID_PATTERN.test(showId)) return null
  const [show] = await db
    .select()
    .from(shows)
    .where(and(eq(shows.id, showId), eq(shows.galleryId, tenant.gallery.id)))
    .limit(1)
  return show ? { gallery: tenant.gallery, show } : null
}

async function staffReportForTenant(
  db: Db,
  galleryId: string,
  showId: string,
  wholeRun = false,
): Promise<StaffReportResult> {
  return {
    status: 200,
    body: {
      visits: await readVisitCounts(db, showId),
      days: await readDays(db, showId, wholeRun),
      works: await readWorkStats(db, galleryId, showId),
      leads: await readLeadList(db, galleryId, showId),
    },
  }
}

export async function readStaffReport(db: Db, tenant: GalleryTenant, accessCode: string): Promise<StaffReportResult> {
  const { gallery, show } = tenant
  if (!gallery.sharedCodeEnabled || !verifySecret(accessCode, gallery.accessCodeHash)) {
    return { status: 401, body: { error: 'That access code does not match.' } }
  }
  return staffReportForTenant(db, gallery.id, show.id)
}

export async function readStaffReportForSession(db: Db, galleryId: string, showId?: string | null): Promise<StaffReportResult> {
  const tenant = await tenantById(db, galleryId)
  if (!tenant) {
    return { status: 401, body: { error: 'Sign in to see visits and phone numbers.' } }
  }
  const selected = await tenantWithShow(db, tenant, showId)
  if (!selected) return { status: 404, body: { error: 'That show was not found.' } }
  return staffReportForTenant(db, tenant.gallery.id, selected.show.id, selected.show.status === 'archived')
}

const DUPLICATE_WORK_ERROR = 'Two works have the same id. Give each work its own id.'
const DUPLICATE_WORK_ERROR_FA = 'دو اثر شناسه یکسان دارند. برای هر اثر شناسه جداگانه بگذارید.'

export const MAX_WORKS = 100
const TOO_MANY_WORKS_ERROR = `You can publish up to ${MAX_WORKS} works.`
const TOO_MANY_WORKS_ERROR_FA = `حداکثر ${localDigits('fa', String(MAX_WORKS))} اثر می‌توانید منتشر کنید.`

function sanitizeRecord(
  input: unknown,
): { error: string; errorFa?: string } | { record: Omit<GalleryRecordDto, 'slug' | 'demo' | 'updatedAt' | 'logo'> & { logo?: string | null } } {
  if (!input || typeof input !== 'object') return { error: 'The record is missing.' }
  const body = input as Record<string, unknown>
  const name = text(body.name, 80)
  if (!name) return { error: 'Enter the gallery name.' }
  if (!Array.isArray(body.works)) return { error: 'Works must be a list.' }
  if (body.works.length > MAX_WORKS) return { error: TOO_MANY_WORKS_ERROR, errorFa: TOO_MANY_WORKS_ERROR_FA }

  const worksOut: GalleryWorkDto[] = []
  const usedIds = new Set<string>()
  for (const raw of body.works) {
    if (!raw || typeof raw !== 'object') return { error: 'One work is not valid.' }
    const work = raw as Record<string, unknown>
    const title = text(work.title, 120)
    if (!title) return { error: 'Enter a title for each work.' }
    const sample = Boolean(work.sample)
    if (sample && !SAMPLE_RE.test(title)) {
      return { error: 'A sample title must include the word sample or نمونه.' }
    }
    let price: number | null = null
    if (work.price !== null && work.price !== undefined && work.price !== '') {
      const parsed = parseToman(work.price)
      if (parsed === 'invalid') {
        return { error: 'Enter a price that is zero or greater, or leave the price empty.' }
      }
      price = parsed
    }
    if (!['available', 'reserved', 'sold'].includes(String(work.status))) {
      return { error: 'Choose a status for each work.' }
    }
    let id = text(work.id, 80)
    if (!/^[a-zA-Z0-9-]{8,80}$/.test(id)) id = crypto.randomUUID()
    // Two rows with one id break show_works_show_work_uidx inside the transaction.
    if (usedIds.has(id)) return { error: DUPLICATE_WORK_ERROR, errorFa: DUPLICATE_WORK_ERROR_FA }
    usedIds.add(id)
    const image = typeof work.image === 'string' ? work.image : ''
    if (image.startsWith('/artworks/')) {
      return { error: 'Use an image you upload. Do not use another gallery’s images.' }
    }
    worksOut.push({
      id,
      sample,
      artist: text(work.artist, 80),
      artistFa: text(work.artistFa, 80),
      title,
      titleFa: text(work.titleFa, 120),
      medium: text(work.medium, 80),
      mediumFa: text(work.mediumFa, 80),
      size: text(work.size, 80),
      year: text(work.year, 20),
      price,
      status: work.status as GalleryWorkDto['status'],
      image,
    })
  }

  let pdfUrl: string | null = null
  if (body.pdfUrl) {
    pdfUrl = text(body.pdfUrl, 500)
    if (!/^https?:\/\/\S+$/i.test(pdfUrl)) {
      return { error: 'The PDF address must start with http:// or https://.' }
    }
  }

  const nameFa = text(body.nameFa, 80) || name
  let logo: string | null | undefined
  if (!Object.prototype.hasOwnProperty.call(body, 'logo') || body.logo === '') {
    logo = undefined
  } else if (body.logo === null) {
    logo = null
  } else if (typeof body.logo === 'string') {
    logo = body.logo
  } else {
    return { error: 'The logo must be a PNG, JPEG, or WebP upload.' }
  }
  return {
    record: {
      name,
      nameFa,
      logo,
      showTitle: text(body.showTitle, 160),
      showTitleFa: text(body.showTitleFa, 160),
      dates: text(body.dates, 80),
      datesFa: text(body.datesFa, 80),
      hours: text(body.hours, 120),
      hoursFa: text(body.hoursFa, 120),
      address: text(body.address, 180),
      addressFa: text(body.addressFa, 180),
      text: text(body.text, 2000),
      textFa: text(body.textFa, 2000),
      pdfUrl,
      startsOn: dayOrNull(body.startsOn),
      endsOn: dayOrNull(body.endsOn),
      works: worksOut,
    },
  }
}

function dayOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) ? null : value
}

const OWN_IMAGE_ERROR = 'Use an image you upload. Do not use another gallery’s images.'
const OWN_IMAGE_ERROR_FA = 'از تصویری استفاده کنید که خودتان بارگذاری کرده‌اید.'

function isOwnGalleryMedia(image: string, gallerySlug: string): boolean {
  return (
    image.startsWith(`/media/galleries/${gallerySlug}/`) ||
    image.startsWith(`/media/u/galleries/${gallerySlug}/`)
  )
}

function isForeignImage(image: string, gallerySlug: string): boolean {
  if (image.startsWith('/artworks/') || image.startsWith('http://') || image.startsWith('https://')) return true
  if (!image.startsWith('/media/')) return false
  return !isOwnGalleryMedia(image, gallerySlug)
}

const UPLOAD_FIRST = 'Upload the image with the upload button first.'
const UPLOAD_FIRST_FA = 'ابتدا تصویر را با دکمه بارگذاری بفرستید.'

function mediaUrls(variants: Record<string, string> | null | undefined): string[] {
  return Object.values(variants || {})
}

async function findOwnMedia(db: Db, galleryId: string, url: string): Promise<string | null> {
  const rows = await db
    .select({ id: media.id, variants: media.variants, s3Key: media.s3Key })
    .from(media)
    .where(eq(media.galleryId, galleryId))
  const hit = rows.find(
    (row: { variants: Record<string, string>; s3Key: string }) =>
      mediaUrls(row.variants).includes(url) || url.endsWith(`/${row.s3Key}`),
  )
  return hit ? hit.id : null
}

function refuse(error: string, errorFa: string) {
  return { status: 400, body: { error, errorFa } }
}

type PublishResult = { status: number; body: { ok: true; record: GalleryRecordDto } | { error: string; errorFa?: string } }

export async function publishGalleryRecord(
  db: Db,
  _storage: ObjectStorage,
  tenant: GalleryTenant,
  accessCode: string,
  input: unknown,
): Promise<PublishResult> {
  if (!tenant.gallery.sharedCodeEnabled || !verifySecret(accessCode, tenant.gallery.accessCodeHash)) {
    return { status: 401, body: { error: 'That access code does not match.' } }
  }
  return writeGalleryRecord(db, tenant, input)
}

export async function publishGalleryRecordForSession(
  db: Db,
  _storage: ObjectStorage,
  galleryId: string,
  input: unknown,
  showId?: string | null,
): Promise<PublishResult> {
  const tenant = await tenantById(db, galleryId)
  if (!tenant) {
    return { status: 401, body: { error: 'Sign in to publish.' } }
  }
  const selected = await tenantWithShow(db, tenant, showId)
  if (!selected) return { status: 404, body: { error: 'That show was not found.', errorFa: 'نمایش پیدا نشد.' } }
  return writeGalleryRecord(db, selected, input)
}

async function writeGalleryRecord(
  db: Db,
  tenant: GalleryTenant,
  input: unknown,
): Promise<PublishResult> {
  const { gallery, show } = tenant
  if (show.status === 'archived') return refuse('An archived show cannot change. Start a new show.', 'نمایش بایگانی‌شده تغییر نمی‌کند. نمایش تازه‌ای شروع کنید.')
  const target = input && typeof input === 'object' ? (input as { slug?: unknown }).slug : undefined
  if (target !== undefined && target !== gallery.slug) return refuse('That record belongs to another gallery.', 'این اطلاعات متعلق به گالری دیگری است.')
  const cleaned = sanitizeRecord(input)
  if ('error' in cleaned) {
    return cleaned.errorFa
      ? refuse(cleaned.error, cleaned.errorFa)
      : { status: 400, body: { error: cleaned.error } }
  }

  try {
    const currentLogo = await logoUrl(db, gallery.id, gallery.logoMediaId)
    let logoMediaId: string | null = gallery.logoMediaId
    const logoInput = cleaned.record.logo
    if (logoInput === null) {
      logoMediaId = null
    } else if (typeof logoInput === 'string' && logoInput.length > 0) {
      if (currentLogo && logoInput === currentLogo) {
        logoMediaId = gallery.logoMediaId
      } else if (logoInput.startsWith('data:')) {
        return refuse(UPLOAD_FIRST, UPLOAD_FIRST_FA)
      } else if (isForeignImage(logoInput, gallery.slug) || !isOwnGalleryMedia(logoInput, gallery.slug)) {
        return refuse('Upload the logo again. A web address is not accepted.', 'لوگو را دوباره بارگذاری کنید. نشانی وب پذیرفته نمی‌شود.')
      } else {
        const found = await findOwnMedia(db, gallery.id, logoInput)
        if (!found) return refuse('Upload the logo again. A web address is not accepted.', 'لوگو را دوباره بارگذاری کنید. نشانی وب پذیرفته نمی‌شود.')
        logoMediaId = found
      }
    }

    const prepared: Array<{ work: GalleryWorkDto; imageUrl: string; mediaId: string | null }> = []
    for (const work of cleaned.record.works) {
      const [owner] = await db
        .select({
          id: works.id,
          galleryId: works.galleryId,
          imageUrl: works.imageUrl,
          mediaId: works.mediaId,
        })
        .from(works)
        .where(eq(works.id, work.id))
        .limit(1)
      if (owner && owner.galleryId !== gallery.id) {
        return refuse('That work belongs to another gallery.', 'این اثر متعلق به گالری دیگری است.')
      }
      if (!work.image) {
        prepared.push({ work, imageUrl: '', mediaId: null })
        continue
      }
      if (owner && work.image === (owner.imageUrl || '')) {
        prepared.push({ work, imageUrl: owner.imageUrl || '', mediaId: owner.mediaId })
        continue
      }
      if (work.image.startsWith('data:')) return refuse(UPLOAD_FIRST, UPLOAD_FIRST_FA)
      if (isForeignImage(work.image, gallery.slug) || !isOwnGalleryMedia(work.image, gallery.slug)) {
        return refuse(OWN_IMAGE_ERROR, OWN_IMAGE_ERROR_FA)
      }
      const mediaId = await findOwnMedia(db, gallery.id, work.image)
      if (!mediaId) return refuse(OWN_IMAGE_ERROR, OWN_IMAGE_ERROR_FA)
      prepared.push({ work, imageUrl: work.image, mediaId })
    }

    const keep = new Set(prepared.map((item) => item.work.id))
    await db.transaction(async (tx: Db) => {
      await tx
        .update(galleries)
        .set({
          nameEn: cleaned.record.name,
          nameFa: cleaned.record.nameFa,
          logoMediaId,
          updatedAt: new Date(),
        })
        .where(eq(galleries.id, gallery.id))

      await tx
        .update(shows)
        .set({
          titleEn: cleaned.record.showTitle,
          titleFa: cleaned.record.showTitleFa,
          datesEn: cleaned.record.dates,
          datesFa: cleaned.record.datesFa,
          hoursEn: cleaned.record.hours,
          hoursFa: cleaned.record.hoursFa,
          addressEn: cleaned.record.address,
          addressFa: cleaned.record.addressFa,
          textEn: cleaned.record.text,
          textFa: cleaned.record.textFa,
          pdfUrl: cleaned.record.pdfUrl,
          startsOn: cleaned.record.startsOn,
          endsOn: cleaned.record.endsOn,
          updatedAt: new Date(),
        })
        .where(eq(shows.id, show.id))

      // Only this show's own works can leave. The works of another show of the gallery stay.
      const dropped = await tx
        .select({ id: showWorks.workId })
        .from(showWorks)
        .where(eq(showWorks.showId, show.id))
      await tx.delete(showWorks).where(eq(showWorks.showId, show.id))
      const removedAt = new Date()
      for (const row of dropped) {
        if (keep.has(row.id)) continue
        const [elsewhere] = await tx.select({ id: showWorks.id }).from(showWorks).where(eq(showWorks.workId, row.id)).limit(1)
        if (!elsewhere) await tx.update(works).set({ removedAt }).where(and(eq(works.id, row.id), eq(works.galleryId, gallery.id)))
      }

      let order = 0
      for (const item of prepared) {
        const values = {
          galleryId: gallery.id,
          artist: item.work.artist,
          artistFa: item.work.artistFa,
          title: item.work.title,
          titleFa: item.work.titleFa,
          medium: item.work.medium,
          mediumFa: item.work.mediumFa,
          size: item.work.size,
          year: item.work.year,
          priceToman: item.work.price,
          status: item.work.status,
          sample: item.work.sample,
          mediaId: item.mediaId,
          imageUrl: item.imageUrl,
          removedAt: null,
          updatedAt: new Date(),
        }
        const [found] = await tx
          .select({ id: works.id })
          .from(works)
          .where(and(eq(works.id, item.work.id), eq(works.galleryId, gallery.id)))
          .limit(1)
        if (found) {
          await tx.update(works).set(values).where(and(eq(works.id, item.work.id), eq(works.galleryId, gallery.id)))
        } else {
          await tx.insert(works).values({ id: item.work.id, ...values })
        }
        await tx.insert(showWorks).values({ showId: show.id, workId: item.work.id, sortOrder: order++ })
      }
    })

    clearPublicRecordCache(db)
    const fresh = (await tenantWithShow(db, (await tenantById(db, gallery.id))!, show.id))!
    return { status: 200, body: { ok: true, record: await readRecord(db, fresh.gallery, fresh.show) } }
  } catch (error) {
    console.error(error)
    return { status: 500, body: { error: 'Publish did not complete. Try again.', errorFa: 'انتشار انجام نشد. دوباره تلاش کنید.' } }
  }
}

export async function recordVisit(
  db: Db,
  tenant: GalleryTenant,
  kind: 'scan' | 'view',
  visitorId: string,
  workId?: string | null,
  qrCode?: string | null,
  now: Date = new Date(),
): Promise<{ status: number; body: { ok: true; counted: boolean; duplicate: boolean; qrShowId?: string | null } | { error: string } }> {
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(visitorId)) {
    return { status: 400, body: { error: 'Visitor id is not valid.' } }
  }
  const fresh = await tenantById(db, tenant.gallery.id)
  if (!isPublicTenant(fresh)) return GALLERY_NOT_FOUND
  const { gallery, show } = fresh
  const day = tehranDay(now)
  if (kind === 'scan') {
    let qrCodeId: string | null = null
    if (typeof qrCode === 'string' && QR_CODE_PATTERN.test(qrCode)) {
      const [qr] = await db
        .select({ id: qrCodes.id })
        .from(qrCodes)
        .innerJoin(shows, eq(shows.id, qrCodes.showId))
        .where(and(eq(qrCodes.code, qrCode), eq(shows.galleryId, gallery.id)))
        .limit(1)
      qrCodeId = qr?.id ?? null
    }
    try {
      await db.insert(visits).values({
        showId: show.id,
        visitorId,
        kind: 'scan',
        day,
        qrCodeId,
        createdAt: now,
      })
      return { status: 200, body: { ok: true, counted: true, duplicate: false, qrShowId: qrCodeId ? show.id : null } }
    } catch {
      return { status: 200, body: { ok: true, counted: false, duplicate: true, qrShowId: qrCodeId ? show.id : null } }
    }
  }

  let resolvedWorkId: string | null = null
  if (workId && /^[a-zA-Z0-9-]{8,80}$/.test(workId)) {
    const [found] = await db
      .select({ id: works.id })
      .from(works)
      .where(and(eq(works.id, workId), eq(works.galleryId, gallery.id)))
      .limit(1)
    resolvedWorkId = found?.id ?? null
  }
  await db.insert(visits).values({
    showId: show.id,
    visitorId,
    kind: 'view',
    day,
    workId: resolvedWorkId,
    createdAt: now,
  })
  return { status: 200, body: { ok: true, counted: true, duplicate: false } }
}

export async function recordLead(
  db: Db,
  tenant: GalleryTenant,
  phone: string,
  kind: 'save' | 'ask',
  visitorId: string,
  workId: string | null | undefined,
  consent: unknown,
  consentTextVersion: unknown,
): Promise<{ status: number; body: { ok: true } | { error: string; code?: string } }> {
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(visitorId)) {
    return { status: 400, body: { error: 'Visitor id is not valid.' } }
  }
  const e164 = mobilePhone(phone)
  if (!e164) {
    return { status: 400, body: { error: 'Enter a valid mobile number with its country code.', code: INVALID_PHONE_CODE } }
  }
  if (consent !== true) {
    return { status: 400, body: { error: 'Consent is required.' } }
  }
  if (consentTextVersion !== CONSENT_TEXT_VERSION) {
    return { status: 400, body: { error: 'The consent text version is not valid.', code: CONSENT_STALE_CODE } }
  }
  if (!workId || !/^[a-zA-Z0-9-]{8,80}$/.test(workId)) {
    return { status: 400, body: { error: 'A work id is required.' } }
  }
  const fresh = await tenantById(db, tenant.gallery.id)
  if (!isPublicTenant(fresh)) return GALLERY_NOT_FOUND
  const { gallery, show } = fresh
  const [found] = await db
    .select({ id: works.id })
    .from(works)
    .where(and(eq(works.id, workId), eq(works.galleryId, gallery.id), isNull(works.removedAt)))
    .limit(1)
  if (!found) {
    return { status: 400, body: { error: 'That work was not found.' } }
  }
  const consentAt = new Date()
  await db.insert(leads).values({
    galleryId: gallery.id,
    showId: show.id,
    workId: found.id,
    phone: e164,
    kind,
    consentAt,
    consentTextVersion: CONSENT_TEXT_VERSION,
  })
  return { status: 200, body: { ok: true } }
}
const CSV_HEADER = [
  'created_at_utc_iso',
  'created_at_tehran_gregorian',
  'created_at_tehran_jalali',
  'kind',
  'phone',
  'work_id',
  'work_title',
  'consent_text_version',
  'verified',
]

function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

function phoneCell(value: string): string {
  const phone = canonicalPhone(value)
  return isE164(phone) ? phone : csvCell(phone)
}

export type LeadCsvRow = {
  at: Date | string
  kind: string
  phone: string
  workId: string | null
  workTitle: string | null
  consentTextVersion: string
}

export function leadsCsv(rows: LeadCsvRow[]): string {
  const lines = [CSV_HEADER.join(',')]
  for (const lead of rows) {
    const at = new Date(lead.at)
    lines.push(
      [
        ...[at.toISOString(), tehranGregorianStamp(at), tehranJalaliStamp(at), lead.kind].map(csvCell),
        phoneCell(lead.phone),
        ...[lead.workId ?? '', lead.workTitle ?? '', lead.consentTextVersion, 'no'].map(csvCell),
      ].join(','),
    )
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export async function leadsCsvForSession(db: Db, galleryId: string, showId?: string | null): Promise<{ status: 200; body: string } | { status: 401 | 404; body: { error: string } }> {
  const tenant = await tenantById(db, galleryId)
  if (!tenant) return { status: 401, body: { error: 'Sign in to download the leads.' } }
  const selected = await tenantWithShow(db, tenant, showId)
  if (!selected) return { status: 404, body: { error: 'That show was not found.' } }
  const rows = await readLeadList(db, tenant.gallery.id, selected.show.id, 10000)
  return { status: 200, body: leadsCsv(rows) }
}

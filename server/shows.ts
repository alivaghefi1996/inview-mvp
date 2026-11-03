import { and, count, desc, eq } from 'drizzle-orm'
import type { AppDatabase } from '../database/context'
import { galleries, leads, shows, visits } from '../database/schema'
import { AccountInputError } from './accounts'
import { writeAudit } from './audit'
import { can, type Principal } from './authz'
import { clearPublicRecordCache } from './gallery-record'
import { auditActor } from './staff'
import { PermissionError } from './team'

function requireEditor(principal: Principal, galleryId: string) {
  if (!can(principal, 'edit-catalogue', galleryId)) throw new PermissionError('Forbidden')
}

async function lockGallery(tx: AppDatabase, galleryId: string) {
  await tx.select({ id: galleries.id }).from(galleries).where(eq(galleries.id, galleryId)).for('update').limit(1)
}

const STATUS_ORDER = { published: 0, draft: 1, archived: 2 } as const

export async function galleryShows(db: AppDatabase, galleryId: string) {
  const rows = await db.select({
    id: shows.id, titleEn: shows.titleEn, titleFa: shows.titleFa, datesEn: shows.datesEn, datesFa: shows.datesFa, status: shows.status,
  }).from(shows).where(eq(shows.galleryId, galleryId)).orderBy(desc(shows.createdAt))
  const visitRows = await db.select({ showId: visits.showId, kind: visits.kind, value: count() }).from(visits)
    .innerJoin(shows, eq(shows.id, visits.showId)).where(eq(shows.galleryId, galleryId)).groupBy(visits.showId, visits.kind)
  const leadRows = await db.select({ showId: leads.showId, value: count() }).from(leads)
    .where(eq(leads.galleryId, galleryId)).groupBy(leads.showId)
  return rows
    .map((show) => ({
      ...show,
      scans: visitRows.find((row) => row.showId === show.id && row.kind === 'scan')?.value ?? 0,
      views: visitRows.find((row) => row.showId === show.id && row.kind === 'view')?.value ?? 0,
      leads: leadRows.find((row) => row.showId === show.id)?.value ?? 0,
    }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
}

/** The gallery has one next show at a time, so a second start opens the draft that exists. */
export async function startNewShow(db: AppDatabase, principal: Principal, galleryId: string) {
  requireEditor(principal, galleryId)
  return db.transaction(async (tx) => {
    await lockGallery(tx, galleryId)
    const [draft] = await tx.select({ id: shows.id }).from(shows)
      .where(and(eq(shows.galleryId, galleryId), eq(shows.status, 'draft'))).orderBy(desc(shows.updatedAt)).limit(1)
    if (draft) return draft
    const [latest] = await tx.select({ hoursEn: shows.hoursEn, hoursFa: shows.hoursFa, addressEn: shows.addressEn, addressFa: shows.addressFa })
      .from(shows).where(eq(shows.galleryId, galleryId)).orderBy(desc(shows.createdAt)).limit(1)
    const [show] = await tx.insert(shows).values({ galleryId, status: 'draft', ...latest }).returning({ id: shows.id })
    await writeAudit(tx, { ...auditActor(principal), galleryId, action: 'show-start', targetType: 'show', targetId: show.id })
    return show
  })
}

/** Visitors move to the new show and the old one is archived in one transaction, so a scan always finds a show. */
export async function publishShow(db: AppDatabase, principal: Principal, galleryId: string, showId: string) {
  requireEditor(principal, galleryId)
  const archived = await db.transaction(async (tx) => {
    await lockGallery(tx, galleryId)
    const [target] = await tx.select().from(shows).where(and(eq(shows.id, showId), eq(shows.galleryId, galleryId))).limit(1)
    if (target?.status !== 'draft') throw new AccountInputError('Only a draft show can be published.', 'فقط پیش‌نویس منتشر می‌شود.')
    if (!target.titleEn.trim() && !target.titleFa.trim()) throw new AccountInputError('Enter a show title before you publish.', 'پیش از انتشار، عنوان نمایش را بنویسید.')
    const now = new Date()
    const previous = await tx.update(shows).set({ status: 'archived', updatedAt: now })
      .where(and(eq(shows.galleryId, galleryId), eq(shows.status, 'published'))).returning({ id: shows.id })
    await tx.update(shows).set({ status: 'published', updatedAt: now }).where(eq(shows.id, showId))
    const actor = auditActor(principal)
    await writeAudit(tx, { ...actor, galleryId, action: 'show-publish', targetType: 'show', targetId: showId, summary: { ...actor.summary, archivedShowId: previous[0]?.id ?? null } })
    return previous[0]?.id ?? null
  })
  clearPublicRecordCache(db)
  return { archivedShowId: archived }
}

/** Only the current show can be archived. The visitor pages then have no show until staff publish the next one. */
export async function archiveShow(db: AppDatabase, principal: Principal, galleryId: string, showId: string) {
  requireEditor(principal, galleryId)
  await db.transaction(async (tx) => {
    await lockGallery(tx, galleryId)
    const rows = await tx.update(shows).set({ status: 'archived', updatedAt: new Date() })
      .where(and(eq(shows.id, showId), eq(shows.galleryId, galleryId), eq(shows.status, 'published'))).returning({ id: shows.id })
    if (!rows.length) throw new AccountInputError('Only the current show can be archived.', 'فقط نمایش جاری بایگانی می‌شود.')
    await writeAudit(tx, { ...auditActor(principal), galleryId, action: 'show-archive', targetType: 'show', targetId: showId })
  })
  clearPublicRecordCache(db)
}

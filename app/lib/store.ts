import { useSyncExternalStore } from 'react'
import { canonicalPhone } from './phone'

export interface SavedWork {
  gallery: string
  id: string
  title: string
  titleFa: string
  artist: string
  artistFa: string
  image: string
  imageSet: { webp: string; jpeg: string } | null
}

export interface VisitStamp {
  gallery: string
  showId: string
  name: string
  nameFa: string
}

export interface GalleryVisit {
  slug: string
  name: string
  nameFa: string
  logo: string | null
}

export interface VisitorState {
  phone: string | null
  saved: string[]
  savedWorks: SavedWork[]
  follows: string[]
  stamps: string[]
  visitStamps: VisitStamp[]
  lastGallery: GalleryVisit | null
  consentVersion: string | null
}

const KEY = 'inview-demo-v1'

/** Stable default for SSR and first client paint. Do not mutate. */
const empty: VisitorState = {
  phone: null,
  saved: [],
  savedWorks: [],
  follows: [],
  stamps: [],
  visitStamps: [],
  lastGallery: null,
  consentVersion: null,
}

const text = (value: unknown) => (typeof value === 'string' ? value : '')
const strings = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [])
const records = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') : []

function parseImageSet(value: unknown): SavedWork['imageSet'] {
  if (!value || typeof value !== 'object') return null
  const { webp, jpeg } = value as Record<string, unknown>
  return typeof webp === 'string' && typeof jpeg === 'string' ? { webp, jpeg } : null
}

function parseGalleryVisit(value: unknown): GalleryVisit | null {
  if (!value || typeof value !== 'object') return null
  const { slug, name, nameFa, logo } = value as Record<string, unknown>
  if (!text(slug)) return null
  return { slug: text(slug), name: text(name), nameFa: text(nameFa), logo: text(logo) || null }
}

export function parseVisitorState(raw: string | null): VisitorState {
  if (!raw) return empty
  try {
    const stored = JSON.parse(raw) as Record<string, unknown> | null
    if (!stored || typeof stored !== 'object') return empty
    return {
      phone: text(stored.phone) || null,
      consentVersion: text(stored.consentVersion) || null,
      saved: strings(stored.saved),
      follows: strings(stored.follows),
      stamps: strings(stored.stamps),
      savedWorks: records(stored.savedWorks)
        .filter((work) => text(work.gallery) && text(work.id))
        .map((work) => ({
          gallery: text(work.gallery),
          id: text(work.id),
          title: text(work.title),
          titleFa: text(work.titleFa),
          artist: text(work.artist),
          artistFa: text(work.artistFa),
          image: text(work.image),
          imageSet: parseImageSet(work.imageSet),
        })),
      visitStamps: records(stored.visitStamps)
        .filter((stamp) => text(stamp.gallery) && text(stamp.showId))
        .map((stamp) => ({
          gallery: text(stamp.gallery),
          showId: text(stamp.showId),
          name: text(stamp.name),
          nameFa: text(stamp.nameFa),
        })),
      lastGallery: parseGalleryVisit(stored.lastGallery),
    }
  } catch {
    return empty
  }
}

export function isDemoVisitor(state: VisitorState, demoSlug: string, demoWorkIds: string[]): boolean {
  if (state.lastGallery) return state.lastGallery.slug === demoSlug
  return state.stamps.includes(demoSlug) || state.saved.some((id) => demoWorkIds.includes(id))
}

function load(): VisitorState {
  if (typeof window === 'undefined') return empty
  try {
    const stored = parseVisitorState(localStorage.getItem(KEY))
    return { ...stored, phone: stored.phone ? canonicalPhone(stored.phone) : null }
  } catch {
    return empty
  }
}

let state: VisitorState = load()
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return state
}

function getServerSnapshot(): VisitorState {
  return empty
}

function set(next: Partial<VisitorState>) {
  state = { ...state, ...next }
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* private mode or storage full: keep working in memory */
  }
  listeners.forEach((l) => l())
}

export function useVisitor() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

export const visitor = {
  signIn: (phone: string, consentVersion: string) => set({ phone, consentVersion }),
  signOut: () => set({ phone: null, consentVersion: null }),
  toggleSaved: (id: string) => set({ saved: toggle(state.saved, id), savedWorks: state.savedWorks.filter((work) => work.id !== id) }),
  save: (id: string) => !state.saved.includes(id) && set({ saved: [...state.saved, id] }),
  saveWork: (work: SavedWork) =>
    set({
      saved: state.saved.includes(work.id) ? state.saved : [...state.saved, work.id],
      savedWorks: [...state.savedWorks.filter((item) => item.id !== work.id), work],
    }),
  toggleFollow: (artist: string) => set({ follows: toggle(state.follows, artist) }),
  stamp: (slug: string) => !state.stamps.includes(slug) && set({ stamps: [...state.stamps, slug] }),
  stampVisit: (stamp: VisitStamp) =>
    !state.visitStamps.some((item) => item.gallery === stamp.gallery && item.showId === stamp.showId) &&
    set({ visitStamps: [...state.visitStamps, stamp] }),
  enterGallery: (visit: GalleryVisit) => {
    const last = state.lastGallery
    if (last && last.slug === visit.slug && last.name === visit.name && last.nameFa === visit.nameFa && last.logo === visit.logo) return
    set({ lastGallery: visit })
  },
  reset: () => set({ ...empty }),
}

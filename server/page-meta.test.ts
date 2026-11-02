import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'

import { galleryPageMeta } from '../app/lib/meta.ts'
import type { PilotRecord, PilotWork } from '../app/lib/pilot.ts'

const CARD_SIZES = '(min-width: 960px) 30vw, calc(50vw - 32px)'
const MATCHES = [{ id: 'root', data: { lang: 'en' as const, origin: 'https://inview.test' } }]

function work(id: string, extra: Partial<PilotWork> = {}): PilotWork {
  return {
    id,
    artist: 'N. Karimi',
    title: 'Harbour light',
    medium: 'Oil',
    size: '40 x 50',
    year: '2024',
    price: 1000000,
    status: 'available',
    image: `/media/u/galleries/sample/${id}/w640.webp`,
    imageSet: {
      webp: `/media/u/galleries/sample/${id}/w320.webp 320w, /media/u/galleries/sample/${id}/w640.webp 640w`,
      jpeg: `/media/u/galleries/sample/${id}/w320.jpeg 320w, /media/u/galleries/sample/${id}/w640.jpeg 640w`,
    },
    sample: false,
    ...extra,
  }
}

function record(works: PilotWork[]): PilotRecord {
  return {
    slug: 'sample',
    name: 'Sample Gallery',
    nameFa: 'گالری نمونه',
    logo: null,
    showTitle: 'Salt and Light',
    showTitleFa: 'نمک و نور',
    dates: '',
    datesFa: '',
    hours: '',
    hoursFa: '',
    address: '',
    addressFa: '',
    text: '',
    textFa: '',
    pdfUrl: null,
    works,
  }
}

function imagePreloads(tags: Record<string, string>[]) {
  return tags.filter((tag) => tag.rel === 'preload' && tag.as === 'image')
}

function worksMeta(works: PilotWork[]) {
  return imagePreloads(galleryPageMeta('works', MATCHES, '/g/sample/works', { pilot: record(works) }))
}

test('the works page preloads the image of the first card', () => {
  const first = work('aaa')
  const preloads = worksMeta([first, work('bbb')])
  assert.equal(preloads.length, 1)
  assert.equal(preloads[0].href, first.image)
  assert.equal(preloads[0].imageSrcSet, first.imageSet?.webp)
  assert.equal(preloads[0].type, 'image/webp')
  assert.equal(preloads[0].fetchPriority, 'high')
})

test('the works preload repeats the sizes that the card markup uses', () => {
  assert.equal(worksMeta([work('aaa')])[0].imageSizes, CARD_SIZES)
})

test('the works page skips the samples that the wall shows after the real works', () => {
  const real = work('bbb')
  const preloads = worksMeta([work('aaa', { sample: true }), real])
  assert.equal(preloads.length, 1)
  assert.equal(preloads[0].href, real.image)
})

test('the works page preloads nothing when the first card has no image', () => {
  assert.deepEqual(worksMeta([work('aaa', { image: '', imageSet: null }), work('bbb')]), [])
})

test('the works page preloads nothing for a gallery with no works', () => {
  assert.deepEqual(worksMeta([]), [])
  assert.deepEqual(worksMeta([work('aaa', { sample: true })]), [])
})

test('the show page keeps the wider sizes of its cover', () => {
  const preloads = imagePreloads(galleryPageMeta('show', MATCHES, '/g/sample', { pilot: record([work('aaa')]) }))
  assert.equal(preloads.length, 1)
  assert.equal(preloads[0].imageSizes, '(min-width: 960px) 55vw, 100vw')
})

test('the prices and about pages preload no image', () => {
  const works = [work('aaa')]
  assert.deepEqual(imagePreloads(galleryPageMeta('prices', MATCHES, '/g/sample/prices', { pilot: record(works) })), [])
  assert.deepEqual(imagePreloads(galleryPageMeta('about', MATCHES, '/g/sample/about', { pilot: record(works) })), [])
})

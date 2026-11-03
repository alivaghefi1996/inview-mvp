import test from 'node:test'
import assert from 'node:assert/strict'
import { isDemoVisitor, parseVisitorState } from '../app/lib/store.ts'

const demoIds = ['demo-1']

test('stored state from before saved snapshots parses without a crash', () => {
  const state = parseVisitorState(JSON.stringify({ phone: '09120000000', saved: ['old-1', 3], stamps: ['rooz-gallery'], follows: null }))
  assert.deepEqual(state.saved, ['old-1'])
  assert.deepEqual(state.savedWorks, [])
  assert.deepEqual(state.visitStamps, [])
  assert.deepEqual(state.follows, [])
  assert.equal(state.lastGallery, null)
})

test('malformed stored state falls back to the empty visitor', () => {
  for (const raw of ['not json', 'null', '7', '[]']) {
    const state = parseVisitorState(raw)
    assert.equal(state.phone, null)
    assert.deepEqual(state.saved, [])
  }
  const broken = parseVisitorState(JSON.stringify({ savedWorks: [null, { id: 'no-gallery' }, 3], visitStamps: [{ gallery: 'g' }], lastGallery: { name: 'x' } }))
  assert.deepEqual(broken.savedWorks, [])
  assert.deepEqual(broken.visitStamps, [])
  assert.equal(broken.lastGallery, null)
})

test('the demo items follow the last gallery the visitor opened', () => {
  const base = parseVisitorState('{}')
  const visit = (slug: string) => ({ slug, name: '', nameFa: '', logo: null })
  assert.equal(isDemoVisitor(base, 'rooz', demoIds), false)
  assert.equal(isDemoVisitor({ ...base, stamps: ['rooz'] }, 'rooz', demoIds), true)
  assert.equal(isDemoVisitor({ ...base, saved: ['demo-1'] }, 'rooz', demoIds), true)
  assert.equal(isDemoVisitor({ ...base, saved: ['demo-1'], lastGallery: visit('o-gallery') }, 'rooz', demoIds), false)
  assert.equal(isDemoVisitor({ ...base, lastGallery: visit('rooz') }, 'rooz', demoIds), true)
})

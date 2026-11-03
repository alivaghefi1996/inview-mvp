import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DEFERRED_ROUTE_IDS, deferModuleScripts, makeModuleScriptsInert } from './defer-module-scripts.ts'

// The shape React Router 7.5 writes at the end of a visitor document.
const SCRIPTS = [
  '<link rel="modulepreload" href="/assets/entry.client-a.js"/>',
  '<link rel="modulepreload" href="/assets/root-b.js"/>',
  '<script>window.__reactRouterContext = {"basename":"/"};</script>',
  '<script type="module" async="">import * as route0 from "/assets/root-b.js";</script>',
].join('')

const DOCUMENT = `<!DOCTYPE html><html lang="fa"><body><h1>آثار</h1>${SCRIPTS}</body></html>`

async function pipeInChunks(html: string, size: number) {
  const found: boolean[] = []
  const stream = deferModuleScripts((hit) => found.push(hit))
  const chunks: Buffer[] = []
  const done = new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('end', () => resolve())
    stream.on('error', reject)
  })
  const bytes = Buffer.from(html, 'utf8')
  for (let at = 0; at < bytes.length; at += size) stream.write(bytes.subarray(at, at + size))
  stream.end()
  await done
  return { html: Buffer.concat(chunks).toString('utf8'), found }
}

test('the markers go inert and every node stays', () => {
  const { html, scripts } = makeModuleScriptsInert(DOCUMENT)
  assert.equal(scripts, 1)
  assert.equal(html.includes('rel="modulepreload"'), false)
  assert.equal(html.includes('<script type="module"'), false)
  assert.equal(html.match(/rel="inview-deferred-modulepreload"/g)?.length, 2)
  assert.equal(html.match(/<script type="inview\/deferred-module"/g)?.length, 1)

  const nodes = (text: string) => text.match(/<(link|script)\b/g)?.length
  assert.equal(nodes(html), nodes(DOCUMENT))
  assert.equal(html.includes('<script>window.__reactRouterContext'), true)
  assert.equal(html.includes('async=""'), true)
})

test('rewriting twice changes nothing more', () => {
  const once = makeModuleScriptsInert(DOCUMENT)
  const twice = makeModuleScriptsInert(once.html)
  assert.equal(twice.html, once.html)
  assert.equal(twice.scripts, 0)
})

test('a marker split across chunks is still rewritten, and Persian text survives', async () => {
  for (const size of [1, 3, 7, 16, 31, 64, 4096]) {
    const { html, found } = await pipeInChunks(DOCUMENT, size)
    assert.equal(html, makeModuleScriptsInert(DOCUMENT).html, `chunk size ${size}`)
    assert.equal(html.includes('آثار'), true, `chunk size ${size}`)
    assert.deepEqual(found, [true], `chunk size ${size}`)
  }
})

test('a document with no module script is passed through, and the miss is reported', async () => {
  const plain = '<!DOCTYPE html><html><body><p>سلام</p></body></html>'
  const { html, found } = await pipeInChunks(plain, 5)
  assert.equal(html, plain)
  assert.deepEqual(found, [false])
})

test('every deferred route id names a route file, and /me is not one of them', () => {
  const config = readFileSync(new URL('../app/routes.ts', import.meta.url), 'utf8')
  for (const id of DEFERRED_ROUTE_IDS) {
    assert.equal(config.includes(`'${id}.tsx'`), true, `${id} is no longer a route`)
  }
  assert.equal(DEFERRED_ROUTE_IDS.has('routes/me'), false)
})

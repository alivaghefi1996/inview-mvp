import { Transform } from 'node:stream'
import { StringDecoder } from 'node:string_decoder'
import { DEFERRED_PRELOAD_REL, DEFERRED_SCRIPT_TYPE } from '../app/lib/deferred-hydration'

/**
 * The public pages that start their module scripts after the load event. Every other page, which
 * means `/me` and each staff, operator and gallery-owner page, hydrates while the document parses.
 * `/me` stays out because its content is the visitor's own saved works, and those only exist once
 * the browser has read local storage.
 */
export const DEFERRED_ROUTE_IDS: ReadonlySet<string> = new Set([
  'routes/home',
  'routes/site.$slug',
  'routes/g.$slug._index',
  'routes/g.$slug.works._index',
  'routes/g.$slug.works.$id',
  'routes/g.$slug.prices',
  'routes/g.$slug.about',
])

const LIVE_PRELOAD = 'rel="modulepreload"'
const LIVE_SCRIPT = '<script type="module"'
const INERT_PRELOAD = `rel="${DEFERRED_PRELOAD_REL}"`
const INERT_SCRIPT = `<script type="${DEFERRED_SCRIPT_TYPE}"`

// No marker is longer than this, so a marker can never straddle two pushes.
const HOLD_BACK = 32

/** Both markers disappear as they are replaced, so running this twice over the same text is safe. */
export function makeModuleScriptsInert(html: string): { html: string; scripts: number } {
  let scripts = 0
  const inert = html
    .replaceAll(LIVE_SCRIPT, () => {
      scripts += 1
      return INERT_SCRIPT
    })
    .replaceAll(LIVE_PRELOAD, INERT_PRELOAD)
  return { html: inert, scripts }
}

/**
 * Rewrites the two attribute values React Router wrote, and keeps every node in place. React 18
 * writes neither attributes nor `innerHTML` during hydration, and `<Scripts />` renders `null`
 * once hydrated, so the client never reconciles these nodes against the markup below.
 */
export function deferModuleScripts(report: (found: boolean) => void = warnOnMiss): Transform {
  const decoder = new StringDecoder('utf8')
  let carry = ''
  let scripts = 0

  return new Transform({
    transform(chunk, _encoding, done) {
      const next = makeModuleScriptsInert(carry + decoder.write(chunk as Buffer))
      scripts += next.scripts
      const push = next.html.length - HOLD_BACK
      if (push > 0) {
        carry = next.html.slice(push)
        this.push(next.html.slice(0, push))
      } else {
        carry = next.html
      }
      done()
    },
    flush(done) {
      this.push(carry + decoder.end())
      report(scripts > 0)
      done()
    },
  })
}

let warned = false

function warnOnMiss(found: boolean) {
  if (found || warned) return
  warned = true
  console.warn(
    JSON.stringify({
      level: 'warn',
      msg: 'deferred hydration found no module script; the visitor pages load their scripts before the paint',
      marker: LIVE_SCRIPT,
    }),
  )
}

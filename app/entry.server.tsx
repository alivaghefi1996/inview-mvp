import { PassThrough } from 'node:stream'

import type { AppLoadContext, EntryContext } from 'react-router'
import { createReadableStreamFromReadable } from '@react-router/node'
import { ServerRouter } from 'react-router'
import { isbot } from 'isbot'
import type { RenderToPipeableStreamOptions } from 'react-dom/server'
import { renderToPipeableStream } from 'react-dom/server'
import { DEFERRED_ROUTE_IDS, deferModuleScripts } from '../server/defer-module-scripts'

export const streamTimeout = 5_000

function defersHydration(routerContext: EntryContext): boolean {
  const matches = routerContext.staticHandlerContext.matches
  const leaf = matches[matches.length - 1]
  return leaf ? DEFERRED_ROUTE_IDS.has(leaf.route.id) : false
}

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext,
) {
  // https://httpwg.org/specs/rfc9110.html#HEAD
  if (request.method.toUpperCase() === 'HEAD') {
    return new Response(null, { status: responseStatusCode, headers: responseHeaders })
  }

  return new Promise((resolve, reject) => {
    let shellRendered = false
    const userAgent = request.headers.get('user-agent')

    // Bots and SPA Mode renders wait for all content before the response goes out.
    const readyOption: keyof RenderToPipeableStreamOptions =
      (userAgent && isbot(userAgent)) || routerContext.isSpaMode ? 'onAllReady' : 'onShellReady'

    let timeoutId: ReturnType<typeof setTimeout> | undefined = setTimeout(() => abort(), streamTimeout + 1000)

    const { pipe, abort } = renderToPipeableStream(<ServerRouter context={routerContext} url={request.url} />, {
      [readyOption]() {
        shellRendered = true
        const body = new PassThrough({
          final(callback) {
            clearTimeout(timeoutId)
            timeoutId = undefined
            callback()
          },
        })
        // ADR 0009: a public page leaves its module scripts inert and starts them after the load
        // event. The rewrite is a stream, so the shell still goes out as React finishes it.
        const html = defersHydration(routerContext) ? body.pipe(deferModuleScripts()) : body
        const stream = createReadableStreamFromReadable(html)

        responseHeaders.set('Content-Type', 'text/html')

        pipe(body)

        resolve(new Response(stream, { headers: responseHeaders, status: responseStatusCode }))
      },
      onShellError(error: unknown) {
        reject(error)
      },
      onError(error: unknown) {
        responseStatusCode = 500
        if (shellRendered) console.error(error)
      },
    })
  })
}

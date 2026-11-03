import { useEffect } from 'react'
import { HYDRATED_ATTRIBUTE, HYDRATION_BOOTSTRAP } from '../lib/deferred-hydration'

/**
 * Starts the module scripts that the server left inert, and marks the document hydrated.
 *
 * The markup is the same on every page. On a page the server did not defer, the inline script
 * finds no inert script and stops, so this component is safe to render everywhere.
 */
export function DeferredHydration() {
  useEffect(() => {
    document.documentElement.setAttribute(HYDRATED_ATTRIBUTE, '')
    return () => document.documentElement.removeAttribute(HYDRATED_ATTRIBUTE)
  }, [])

  return <script dangerouslySetInnerHTML={{ __html: HYDRATION_BOOTSTRAP }} />
}

import { database } from '../../database/context'
import { staffHeaders, staffPrincipal } from '../../server/staff'
import { styleDictionaries } from '../lib/i18n-style'
import type { Lang } from '../lib/lang'
import StyleGuide from '../pages/gallery/StyleGuide'
import persianFonts from '../styles-fa.css?url'
import styleGuide from '../styles-guide.css?url'

export const headers = staffHeaders
export const links = () => [
  { rel: 'stylesheet', href: persianFonts },
  { rel: 'stylesheet', href: styleGuide },
]
export function meta({ matches }: { matches: ({ id: string; data?: unknown } | undefined)[] }) {
  const root = matches.find((match) => match?.id === 'root')?.data as { lang?: Lang } | undefined
  return [{ title: styleDictionaries[root?.lang ?? 'fa'].pageTitle }, { name: 'robots', content: 'noindex' }]
}
export async function loader({ request }: { request: Request }) {
  await staffPrincipal(database(), request)
  return null
}
export default function StaffStyle() {
  return <StyleGuide />
}

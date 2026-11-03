import type { MetaFunction } from 'react-router'
import { pageMeta, rootData } from '../lib/meta'
import InviewLanding, { landingCopy } from '../pages/site/InviewLanding'

export const meta: MetaFunction = ({ matches }) => {
  const { lang, origin } = rootData(matches)
  const words = landingCopy[lang]
  return pageMeta({ lang, origin, path: '/', title: words.title, description: words.description, image: '/landing/share.png' })
}

export default function Home() {
  return <InviewLanding />
}

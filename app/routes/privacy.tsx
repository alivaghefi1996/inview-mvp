import { Link, type MetaFunction } from 'react-router'
import { LangSwitch } from '~/components/LangSwitch'
import { PRIVACY_PATH, privacyPage } from '~/lib/consent'
import { useT } from '~/lib/i18n'
import { metaCopy, pageMeta, rootData } from '~/lib/meta'

export const meta: MetaFunction = ({ matches }) => {
  const { lang, origin } = rootData(matches)
  const page = privacyPage[lang]
  return pageMeta({ lang, origin, path: PRIVACY_PATH, title: `${page.title} · ${metaCopy(lang).site}`, description: page.description })
}

export default function Privacy() {
  const { lang, dir } = useT()
  const page = privacyPage[lang]
  return (
    <main className="pad privacy-page" dir={dir}>
      <div className="row between"><Link className="btn-text inline" to="/">{page.home}</Link><LangSwitch /></div>
      <h1 className="page-title">{page.title}</h1>
      <p className="reading">{page.intro}</p>
      {page.sections.map((section) => (
        <section key={section.heading}>
          <h2 className="section-title">{section.heading}</h2>
          <p className="reading">{section.body}</p>
        </section>
      ))}
    </main>
  )
}

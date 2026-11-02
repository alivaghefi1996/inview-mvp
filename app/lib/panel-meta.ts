import type { Lang } from './lang'

type MetaArgs = { matches: ({ id: string; data?: unknown } | undefined)[] }

export function panelMeta<Key extends string>(dictionaries: Record<Lang, Record<Key | 'brand', string>>, key: Key) {
  return ({ matches }: MetaArgs) => {
    const root = matches.find((match) => match?.id === 'root')?.data as { lang?: Lang } | undefined
    const words = dictionaries[root?.lang ?? 'fa']
    return [{ title: `${words[key]} · ${words.brand}` }, { name: 'robots', content: 'noindex' }]
  }
}

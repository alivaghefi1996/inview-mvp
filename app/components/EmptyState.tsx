import { useId, type ReactNode } from 'react'

export function EmptyState({
  title,
  body,
  action,
  headingLevel = 2,
}: {
  title: string
  body?: string
  action?: ReactNode
  headingLevel?: 1 | 2
}) {
  const titleId = useId()
  const Title = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <section className="empty-state reveal" aria-labelledby={titleId}>
      <span className="ink-rule" aria-hidden />
      <Title id={titleId}>{title}</Title>
      {body ? <p>{body}</p> : null}
      {action}
    </section>
  )
}

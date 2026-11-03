import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'

const dir = 'visual-qa-report'
const commit = process.env.QA_COMMIT || 'unknown'
const baseUrl = process.env.QA_BASE_URL || 'https://inview.moshes.io'
const artifactsUrl = process.env.QA_RUN_URL || ''

const pages = readdirSync(`${dir}/pages`)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(`${dir}/pages/${f}`, 'utf8')))
  .sort((a, b) => a.id.localeCompare(b.id))

const impeccable = existsSync(`${dir}/impeccable.json`)
  ? JSON.parse(readFileSync(`${dir}/impeccable.json`, 'utf8'))
  : {}
// Playwright 1.64.1 writes a -diff.png for a size mismatch as well as for a
// pixel mismatch. Match -actual.png too, so that a version that drops the diff
// image still reports the page as changed instead of as same.
const rejected = existsSync(`${dir}/diffs`)
  ? readdirSync(`${dir}/diffs`, { recursive: true })
      .map(String)
      .filter((f) => f.endsWith('-diff.png') || f.endsWith('-actual.png'))
  : []
const visualFailed = new Set(rejected.map((f) => f.split('/').pop().replace(/-(diff|actual)\.png$/, '')))

// Rules accepted in HAD-91 as the paper-and-ink look. They are listed, not failed.
// Advisory findings from impeccable (straggler, unbalanced-heading) are also listed, not failed.
// Any other finding fails the verdict.
const acceptedRules = {
  'cream-palette': 'warm paper background is the brand look',
  'kicker-above-heading': 'small label above a heading is part of the gallery type system',
  'hero-eyebrow-chip': 'the "Current show" label is the gallery type system',
}

const rows = []
const notes = []
const issues = []
for (const p of pages) {
  const changed = visualFailed.has(p.id)
  const axeCount = p.axe.length
  const imp = impeccable[p.id.replace(/-(fa|en)$/, '')]
  const expectedError = p.expectedStatus >= 400
  const skipped = imp && !Array.isArray(imp) && expectedError && p.httpOk
  if (imp && !Array.isArray(imp) && !skipped) issues.push(`${p.id}: impeccable did not run (${imp.error})`)
  const failing = Array.isArray(imp)
    ? imp.filter((f) => f.antipattern === 'low-contrast' || (!f.advisory && !(f.antipattern in acceptedRules)))
    : []
  const impCount = Array.isArray(imp) ? failing.length : null
  for (const f of failing) issues.push(`${p.id}: impeccable ${f.antipattern}: ${f.snippet} (${f.selector})`)
  if (Array.isArray(imp)) {
    for (const f of imp) if (!failing.includes(f)) notes.push(`${p.id}: ${f.antipattern}`)
  }
  if (!p.httpOk) issues.push(`${p.id}: HTTP ${p.httpStatus}`)
  if (changed) issues.push(`${p.id}: screenshot differs from the approved image`)
  if (p.imagesSettled === false) issues.push(`${p.id}: images were still loading at the screenshot`)
  for (const src of p.blankImages ?? []) issues.push(`${p.id}: image did not load: ${src}`)
  for (const v of p.axe) issues.push(`${p.id}: axe ${v.impact} ${v.id} (${v.nodes} nodes)`)
  const errorCounts = new Map()
  for (const e of p.pageErrors) {
    const short = e.replace(/; visit .*$/, '')
    errorCounts.set(short, (errorCounts.get(short) || 0) + 1)
  }
  for (const [e, n] of errorCounts) issues.push(`${p.id}: page error x${n}: ${e}`)
  rows.push(
    `| ${p.id} | ${p.httpStatus} | ${p.visual === 'no-baseline' ? 'no baseline' : changed ? 'changed' : 'same'} | ${axeCount} | ${skipped ? 'skipped (error page)' : impCount ?? 'n/a'} |`,
  )
}

// A page whose test stopped early writes no JSON. Without this, the verdict
// reads as PASS because no result is not a failed result.
const reported = new Set(pages.map((p) => p.id))
const approved = existsSync('visual-qa/baselines')
  ? readdirSync('visual-qa/baselines').filter((f) => f.endsWith('.png'))
  : []
for (const file of approved) {
  const id = file.replace(/\.png$/, '')
  if (!reported.has(id)) issues.push(`${id}: the page has an approved image but gave no result`)
}

const missing = pages.filter((p) => p.visual === 'no-baseline').length
// A new route starts with no approved image, and an unapproved page compares
// nothing. Once the set exists, say so, so that the gap cannot read as PASS.
if (approved.length && missing) {
  for (const p of pages) {
    if (p.visual === 'no-baseline') issues.push(`${p.id}: the page has no approved image`)
  }
}
const verdict = issues.length === 0 ? 'PASS' : 'FAIL'
const countOf = (key) => new Set(pages.map((p) => p[key])).size
const lines = [
  `## Visual QA: ${verdict}`,
  '',
  `Release commit: \`${commit}\``,
  `Site: ${baseUrl}`,
  artifactsUrl ? `Artifacts: ${artifactsUrl}` : '',
  `Pages checked: ${pages.length} (${countOf('path')} routes, ${countOf('viewport')} viewports, ${countOf('lang')} languages)`,
  missing ? `Pages without an approved image: ${missing}` : '',
  '',
  '| Page | HTTP | Screenshot | axe serious/critical | impeccable |',
  '| --- | --- | --- | --- | --- |',
  ...rows,
  '',
  issues.length ? '### Issues' : '### Issues\n\nNone.',
  ...issues.map((i) => `- ${i}`),
  notes.length ? '\n### Accepted or advisory impeccable findings (not failing)' : '',
  ...Object.entries(
    notes.reduce((acc, n) => {
      const rule = n.split(': ')[1]
      acc[rule] = (acc[rule] || 0) + 1
      return acc
    }, {}),
  ).map(([rule, n]) => `- ${rule}: ${n} pages${acceptedRules[rule] ? ` (accepted: ${acceptedRules[rule]})` : ' (advisory)'}`),
].filter((l) => l !== '')

writeFileSync(`${dir}/summary.md`, lines.join('\n') + '\n')
writeFileSync(`${dir}/verdict.txt`, verdict + '\n')
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n')
console.log(lines.join('\n'))

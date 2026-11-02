import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '../../components/EmptyState'
import { StaffLangSwitch } from '../../components/StaffLangSwitch'
import {
  colourTokens,
  contrastPairs,
  contrastRatio,
  hexFor,
  radiusTokens,
  spaceTokens,
} from '../../lib/design-tokens'
import { useStaffT } from '../../lib/i18n-staff'
import { styleDictionaries } from '../../lib/i18n-style'
import type { Lang } from '../../lib/lang'

const SECTIONS = [
  ['type', 'typeTitle'],
  ['colour', 'colourTitle'],
  ['contrast', 'contrastTitle'],
  ['space', 'spaceTitle'],
  ['motion', 'motionTitle'],
  ['buttons', 'buttonsTitle'],
  ['chips', 'chipsTitle'],
  ['status', 'statusTitle'],
  ['wall', 'wallTitle'],
  ['price', 'priceTitle'],
  ['sheet', 'sheetTitle'],
  ['fields', 'fieldsTitle'],
  ['states', 'statesTitle'],
  ['tables', 'tablesTitle'],
  ['charts', 'chartsTitle'],
] as const

const TYPE_ROLES = [
  { key: 'pageTitle', className: 'page-title', code: '.page-title' },
  { key: 'sectionTitle', className: 'section-title', code: '.section-title' },
  { key: 'reading', className: 'reading', code: '.reading' },
  { key: 'body', className: '', code: 'body' },
  { key: 'small', className: 'small', code: '.small' },
  { key: 'eyebrow', className: 'eyebrow', code: '.eyebrow' },
  { key: 'tiny', className: 'tiny', code: '.tiny' },
] as const

const TABLE_ROWS = [
  [128, 412],
  [96, 305],
  [143, 467],
]

const BAR_SHARES = [
  { share: 42, tone: 'pine' },
  { share: 58, tone: 'copper' },
  { share: 12, tone: 'pine' },
]

function Code({ children }: { children: string }) {
  return <code className="sg-code" dir="ltr">{children}</code>
}

function Plate({ id, title, note, children }: { id: string; title: string; note: string; children: ReactNode }) {
  return (
    <section className="sg-plate" id={id} aria-labelledby={`${id}-title`}>
      <header className="sg-plate-head">
        <h2 id={`${id}-title`}>{title}</h2>
        <p>{note}</p>
      </header>
      <div className="sg-plate-body">{children}</div>
    </section>
  )
}

function Specimen({ code, visitor, ground, lang, children }: { code: string; visitor?: boolean; ground?: boolean; lang: Lang; children: ReactNode }) {
  return (
    <figure className="sg-specimen">
      <div className={`sg-stage${visitor ? ' visitor' : ''}${visitor && lang === 'fa' ? ' fa' : ''}${ground ? ' sg-stage-ground' : ''}`}>{children}</div>
      <figcaption><Code>{code}</Code></figcaption>
    </figure>
  )
}

export default function StyleGuide() {
  const { lang, dir, format } = useStaffT()
  const t = styleDictionaries[lang]
  const [chip, setChip] = useState(0)
  const ratio = new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className={`staff sg${lang === 'fa' ? ' staff-fa' : ''}`} dir={dir}>
      <div className="staff-bar">
        <p className="brand">{t.brand}</p>
        <div className="staff-tools">
          <Link className="btn-text" to="/staff">{t.backToStaff}</Link>
          <StaffLangSwitch />
        </div>
      </div>

      <header className="sg-hero">
        <div className="sg-hero-copy reveal">
          <h1>{t.heroTitle}</h1>
          <span className="ink-rule sg-rule" aria-hidden />
          <p>{t.heroBody}</p>
        </div>
        <p className="sg-hero-glyphs" aria-hidden>
          <span lang="en" dir="ltr">{t.glyphLatin}</span>
          <span lang="fa" dir="rtl">{t.glyphPersian}</span>
        </p>
      </header>

      <div className="sg-layout">
        <nav className="sg-index" aria-label={t.contents}>
          <ul>
            {SECTIONS.map(([id, key]) => <li key={id}><a href={`#${id}`}>{t[key]}</a></li>)}
          </ul>
        </nav>

        <main className="sg-main">
          <Plate id="type" title={t.typeTitle} note={t.typeNote}>
            <div className="sg-ledger">
              {TYPE_ROLES.map((role) => (
                <div className="sg-type-row" key={role.key}>
                  <div className="sg-type-meta">
                    <strong>{t.typeRoles[role.key]}</strong>
                    <Code>{role.code}</Code>
                  </div>
                  <div className="sg-type-sample visitor" lang="en" dir="ltr" role="group" aria-label={t.typeLatin}>
                    <p className={role.className}>{t.typeSampleEn}</p>
                  </div>
                  <div className="sg-type-sample visitor fa" lang="fa" dir="rtl" role="group" aria-label={t.typePersian}>
                    <p className={role.className}>{t.typeSampleFa}</p>
                  </div>
                </div>
              ))}
            </div>
          </Plate>

          <Plate id="colour" title={t.colourTitle} note={t.colourNote}>
            <div className="sg-swatches" role="list">
              {colourTokens.map((token) => (
                <div className="sg-swatch" role="listitem" key={token.name}>
                  <span className="sg-chip" style={{ background: `var(${token.name})` }} aria-hidden />
                  <span className="sg-swatch-name">
                    <Code>{token.name}</Code>
                    <Code>{token.hex}</Code>
                  </span>
                  <span className="sg-swatch-use">{t.colourUses[token.name]}</span>
                </div>
              ))}
            </div>
          </Plate>

          <Plate id="contrast" title={t.contrastTitle} note={t.contrastNote}>
            <div className="sg-scroll staff-table" tabIndex={0} role="region" aria-label={t.contrastTitle}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t.contrastPair}</th>
                    <th scope="col" className="num">{t.contrastRatio}</th>
                    <th scope="col">{t.contrastKind}</th>
                  </tr>
                </thead>
                <tbody>
                  {contrastPairs.map((pair) => {
                    const foreground = pair.foreground === 'white' ? '#FFFFFF' : `var(${pair.foreground})`
                    return (
                      <tr key={`${pair.foreground}${pair.background}`}>
                        <td>
                          <span className="sg-pair">
                            <span className="sg-pair-sample" style={{ background: `var(${pair.background})`, color: foreground }} aria-hidden>{pair.kind === 'text' ? t.typeRoles.body : <span className="sg-pair-mark" />}</span>
                            <span className="sg-pair-names">
                              <Code>{pair.foreground === 'white' ? t.white : pair.foreground}</Code>
                              <Code>{pair.background}</Code>
                            </span>
                          </span>
                        </td>
                        <td className="num">{ratio.format(contrastRatio(hexFor(pair.foreground), hexFor(pair.background)))}</td>
                        <td>{t.contrastKinds[pair.kind]}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Plate>

          <Plate id="space" title={t.spaceTitle} note={t.spaceNote}>
            <h3 className="sg-sub">{t.space}</h3>
            <ul className="sg-scale">
              {spaceTokens.map((token) => (
                <li key={token.name}>
                  <Code>{token.name}</Code>
                  <span className="sg-scale-bar" style={{ inlineSize: `var(${token.name})` }} aria-hidden />
                  <span>{format.number(token.px)} {t.pixels}</span>
                </li>
              ))}
            </ul>
            <h3 className="sg-sub">{t.radius}</h3>
            <ul className="sg-radii">
              {radiusTokens.map((token) => (
                <li key={token.name}>
                  <span className="sg-radius" style={{ borderStartStartRadius: `var(${token.name})` }} aria-hidden />
                  <Code>{token.name}</Code>
                  <span>{format.number(token.px)} {t.pixels}</span>
                </li>
              ))}
            </ul>
            <h3 className="sg-sub">{t.elevation}</h3>
            <p className="sg-elevation">{t.elevationBody}</p>
            <h3 className="sg-sub">{t.grid}</h3>
            <dl className="sg-rows">
              {t.gridRows.map((row) => (
                <div key={row.width}><dt>{row.width}</dt><dd>{row.body}</dd></div>
              ))}
            </dl>
          </Plate>

          <Plate id="motion" title={t.motionTitle} note={t.motionNote}>
            <dl className="sg-rows">
              {t.motionRows.map((row) => (
                <div key={row.name}><dt><Code>{row.name}</Code></dt><dd>{row.body}</dd></div>
              ))}
            </dl>
          </Plate>

          <Plate id="buttons" title={t.buttonsTitle} note={t.buttonsNote}>
            <Specimen lang={lang} visitor code=".btn .btn-primary | .btn-outline | .btn-quiet | .btn-light | .btn-text">
              <div className="sg-flow">
                <button type="button" className="btn btn-primary">{t.btnPrimary}</button>
                <button type="button" className="btn btn-outline">{t.btnOutline}</button>
                <button type="button" className="btn btn-quiet">{t.btnQuiet}</button>
                <button type="button" className="btn btn-light">{t.btnLight}</button>
                <button type="button" className="btn-text">{t.btnText}</button>
              </div>
            </Specimen>
            <Specimen lang={lang} visitor code=".btn.is-loading | .btn:disabled">
              <div className="sg-flow">
                <button type="button" className="btn btn-primary is-loading" aria-busy="true">{t.btnLoading}</button>
                <button type="button" className="btn btn-primary" disabled>{t.btnDisabled}</button>
              </div>
            </Specimen>
          </Plate>

          <Plate id="chips" title={t.chipsTitle} note={t.chipsNote}>
            <Specimen lang={lang} visitor code=".chips button[aria-pressed]">
              <div className="chips sg-chips">
                {t.chips.map((label, index) => (
                  <button type="button" key={label} aria-pressed={chip === index} onClick={() => setChip(index)}>{label}</button>
                ))}
              </div>
            </Specimen>
          </Plate>

          <Plate id="status" title={t.statusTitle} note={t.statusNote}>
            <Specimen lang={lang} visitor code=".status .s-available | .s-reserved | .s-sold">
              <div className="sg-flow">
                <span className="status s-available">{t.available}</span>
                <span className="status s-reserved">{t.reserved}</span>
                <span className="status s-sold">{t.sold}</span>
              </div>
            </Specimen>
            <Specimen lang={lang} visitor code=".pill .good | .warn">
              <div className="sg-flow">
                <span className="pill good">{t.pillGood}</span>
                <span className="pill warn">{t.pillWarn}</span>
              </div>
            </Specimen>
          </Plate>

          <Plate id="wall" title={t.wallTitle} note={t.wallNote}>
            <Specimen lang={lang} visitor code=".wall-label .work-artist .ink-rule .work-title">
              <div className="wall-label sg-wall">
                <p className="work-artist">{t.sampleArtist}</p>
                <span className="ink-rule" aria-hidden />
                <p className="work-title">{t.sampleWork}</p>
                <p className="muted">{t.sampleMedium}</p>
              </div>
            </Specimen>
            <Specimen lang={lang} visitor code=".label .label-artist .label-meta .label-row">
              <div className="label sg-card-label">
                <span className="label-artist">{t.sampleArtist}</span>
                <span className="label-meta">{t.sampleMedium}</span>
                <span className="label-row">
                  <span className="label-price">{t.samplePrice}</span>
                  <span className="status s-available">{t.available}</span>
                </span>
              </div>
            </Specimen>
          </Plate>

          <Plate id="price" title={t.priceTitle} note={t.priceNote}>
            <Specimen lang={lang} visitor code=".row.between.price-row .work-price">
              <div className="row between price-row sg-price">
                <span className="work-price">{t.samplePrice}</span>
                <span className="status s-reserved">{t.reserved}</span>
              </div>
            </Specimen>
          </Plate>

          <Plate id="sheet" title={t.sheetTitle} note={t.sheetNote}>
            <Specimen lang={lang} visitor ground code=".sheet .sheet-head .sheet-body .sheet-form">
              <div className="sheet">
                <div className="sheet-handle" aria-hidden />
                <div className="sheet-head">
                  <div>
                    <p className="sg-sheet-title">{t.sheetHeading}</p>
                    <p className="muted small">{t.sheetSub}</p>
                  </div>
                </div>
                <p className="sheet-body">{t.sheetBody}</p>
                <div className="sheet-form">
                  <label htmlFor="sg-phone">{t.phone}</label>
                  <input id="sg-phone" type="tel" inputMode="tel" dir="ltr" autoComplete="off" />
                  <button type="button" className="btn btn-primary">{t.sheetAction}</button>
                </div>
              </div>
            </Specimen>
          </Plate>

          <Plate id="fields" title={t.fieldsTitle} note={t.fieldsNote}>
            <Specimen lang={lang} visitor code=".sheet-form label input | .error">
              <div className="sheet-form sg-fields">
                <label htmlFor="sg-name">{t.fieldName}</label>
                <input id="sg-name" type="text" defaultValue={t.fieldNameValue} />
                <label htmlFor="sg-code">{t.fieldCode}</label>
                <input id="sg-code" type="text" aria-invalid aria-describedby="sg-code-error" defaultValue="4821" dir="ltr" />
                <p id="sg-code-error" className="error">{t.fieldCodeError}</p>
                <label htmlFor="sg-locked">{t.fieldLocked}</label>
                <input id="sg-locked" type="text" disabled defaultValue={t.fieldLockedValue} dir="ltr" />
              </div>
            </Specimen>
          </Plate>

          <Plate id="states" title={t.statesTitle} note={t.statesNote}>
            <Specimen lang={lang} visitor code=".empty-state .ink-rule">
              <EmptyState title={t.emptyTitle} body={t.emptyBody} action={<button type="button" className="btn btn-primary">{t.emptyAction}</button>} />
            </Specimen>
            <Specimen lang={lang} visitor code=".empty .page-title .btn-outline">
              <div className="empty sg-error">
                <p className="page-title">{t.errorTitle}</p>
                <p className="muted no-m">{t.errorBody}</p>
                <button type="button" className="btn btn-outline">{t.errorAction}</button>
              </div>
            </Specimen>
            <Specimen lang={lang} visitor code=".skeleton">
              <div className="sg-skeleton" role="status" aria-label={t.loading}>
                <span className="skeleton" aria-hidden />
                <span className="skeleton" aria-hidden />
                <span className="skeleton" aria-hidden />
              </div>
            </Specimen>
          </Plate>

          <Plate id="tables" title={t.tablesTitle} note={t.tablesNote}>
            <Specimen lang={lang} code=".staff-totals | .staff-table table .num">
              <dl className="staff-totals">
                <div><dt>{t.totalsScans}</dt><dd>{format.number(367)}</dd></div>
                <div><dt>{t.totalsViews}</dt><dd>{format.number(1184)}</dd></div>
                <div><dt>{t.totalsLeads}</dt><dd>{format.number(23)}</dd></div>
              </dl>
              <div className="staff-table">
                <h3>{t.tableHeading}</h3>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{t.tableDay}</th>
                      <th scope="col" className="num">{t.tableScans}</th>
                      <th scope="col" className="num">{t.tableViews}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TABLE_ROWS.map(([scans, views], index) => (
                      <tr key={t.tableDays[index]}>
                        <td>{t.tableDays[index]}</td>
                        <td className="num">{format.number(scans)}</td>
                        <td className="num">{format.number(views)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Specimen>
          </Plate>

          <Plate id="charts" title={t.chartsTitle} note={t.chartsNote}>
            <Specimen lang={lang} code=".bars .bar-track .bar.pine | .bar.copper">
              <ul className="bars" role="list">
                {BAR_SHARES.map((bar, index) => (
                  <li key={t.bars[index]}>
                    <span className="bar-label">{t.bars[index]}</span>
                    <span className="bar-track"><span className={`bar ${bar.tone}`} style={{ inlineSize: `${bar.share}%` }} /></span>
                    <span className="bar-value"><strong>{format.number(bar.share)}</strong></span>
                  </li>
                ))}
              </ul>
            </Specimen>
          </Plate>
        </main>
      </div>
    </div>
  )
}

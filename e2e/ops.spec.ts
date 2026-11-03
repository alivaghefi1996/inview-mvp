import AxeBuilder from '@axe-core/playwright'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { expect, test, type Page } from '@playwright/test'
import { createOperatorInvite } from '../scripts/create-operator.mjs'

async function accessible(page: Page) {
  const result = await new AxeBuilder({ page }).analyze()
  expect(result.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical')
    .map((item) => ({ id: item.id, targets: item.nodes.map((node) => node.target) }))).toEqual([])
  expect(await page.locator('h1').count()).toBe(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

for (const width of [390, 1440]) {
  for (const lang of ['fa', 'en'] as const) {
    test(`operator invite, sign-in, gallery and team at ${width} in ${lang}`, async ({ page, baseURL, browser }, testInfo) => {
      test.setTimeout(180000)
      const origin = baseURL || 'http://127.0.0.1:3000'
      const id = randomUUID().slice(0, 8)
      const email = `ops-${id}@example.com`
      const slug = `ops-${id}`
      const publicPath = `/g/${slug}`
      const nameFa = 'گالری آزمایشی'
      const nameEn = 'Test gallery'
      const sql = postgres(process.env.DATABASE_URL!, { max: 1 })
      let invite: string
      try {
        invite = await createOperatorInvite(sql, { email, name: 'Test operator', role: 'admin', publicAppUrl: origin })
      } finally { await sql.end() }
      await page.setViewportSize({ width, height: 900 })
      await page.context().addCookies([{ name: 'inview-lang', value: lang, url: origin }])
      await page.goto('/ops')
      await expect(page).toHaveURL(/\/ops\/sign-in$/)
      await accessible(page)
      await page.screenshot({ path: testInfo.outputPath('sign-in.png') })
      await page.goto(invite)
      await accessible(page)
      await page.locator('input[name="name"]').fill('Test operator')
      await page.locator('input[name="password"]').fill('operator-password')
      await page.locator('form button[type="submit"], form button:not([type])').click()
      await expect(page).toHaveURL(/\/ops$/)
      await page.locator('form[action="/ops/sign-out"] button').click()
      await expect(page).toHaveURL(/\/ops\/sign-in$/)
      await page.locator('input[name="identifier"]').fill(email)
      await page.locator('input[name="password"]').fill('operator-password')
      await page.locator('form > button').click()
      await expect(page).toHaveURL(/\/ops$/)
      await accessible(page)
      await page.screenshot({ path: testInfo.outputPath('overview.png') })
      await page.goto('/ops/galleries/new')
      await accessible(page)
      await page.screenshot({ path: testInfo.outputPath('new-gallery.png') })
      await page.locator('[name="slug"]').fill(slug)
      await page.locator('[name="nameFa"]').fill(nameFa)
      await page.locator('[name="nameEn"]').fill(nameEn)
      await page.locator('[name="showTitle"]').fill('First show')
      await page.locator('[name="ownerIdentifier"]').fill(`owner-${id}@example.com`)
      await page.locator('.ops-form button').click()
      await expect(page.locator('.ops-once textarea')).toBeVisible()
      const ownerInvite = await page.locator('.ops-once textarea').inputValue()
      expect(new URL(ownerInvite).pathname.startsWith('/staff/invite/')).toBe(true)
      await accessible(page)
      await page.reload()
      await expect(page.locator('.ops-once')).toHaveCount(0)
      const staffContext = await browser.newContext({ baseURL: origin })
      try {
        const ownerPage = await staffContext.newPage()
        await ownerPage.goto(ownerInvite)
        await ownerPage.locator('[name="name"]').fill('Gallery owner')
        await ownerPage.locator('[name="password"]').fill('owner-password')
        await ownerPage.locator('form > button').click()
        await expect(ownerPage).toHaveURL(new RegExp(`/staff/${slug}$`))
        for (const path of ['/ops', '/ops/galleries/new', `/ops/galleries/${slug}`, `/ops/galleries/${slug}/team`, `/ops/galleries/${slug}/qr`, `/ops/galleries/${slug}/leads`, `/ops/galleries/${slug}/leads.csv`, `/ops/galleries/${slug}/activity`, '/ops/operators', '/ops/inquiries', '/ops/audit', '/ops/health']) {
          expect((await ownerPage.request.get(path)).status()).toBe(403)
        }
      } finally { await staffContext.close() }
      await page.goto(`/ops/galleries/${slug}/team`)
      await expect(page.getByRole('heading', { name: 'Gallery owner' })).toBeVisible()
      await accessible(page)
      await page.screenshot({ path: testInfo.outputPath('team.png') })
      await page.goto(`/ops/galleries/${slug}`)
      await accessible(page)
      await page.screenshot({ path: testInfo.outputPath('profile.png') })
      expect((await page.request.get(publicPath)).status()).toBe(404)
      await page.locator('[name="notes"]').fill('Operator note')
      await page.locator('[name="status"]').selectOption('live')
      await page.locator('.ops-form button').click()
      await expect(page.getByRole('status')).toBeVisible()
      await page.reload()
      await expect(page.locator('[name="notes"]')).toHaveValue('Operator note')
      await page.locator('button[value="rotate"]').click()
      await expect(page.locator('.ops-once textarea')).toBeVisible()
      await page.reload()
      await expect(page.locator('.ops-once')).toHaveCount(0)
      const response = await page.request.post(`/ops/galleries/${slug}`, { headers: { Origin: 'https://invalid.example' }, form: { intent: 'rotate' } })
      expect(response.status()).toBe(403)
      await expect.poll(async () => (await page.request.get(publicPath)).status(), { timeout: 15000 }).toBe(200)
      await page.goto(publicPath)
      await expect(page.getByRole('link', { name: lang === 'fa' ? nameFa : nameEn })).toBeVisible()
      const seed = postgres(process.env.DATABASE_URL!, { max: 1 })
      try {
        const [gallery] = await seed`select id from galleries where slug = ${slug}`
        await seed`insert into works(id, gallery_id, title, title_fa) values (${`work-${id}`}, ${gallery.id}, 'Operator work', 'اثر اپراتور')`
        await seed`insert into leads(gallery_id, work_id, phone, kind, consent_at, consent_text_version) values (${gallery.id}, ${`work-${id}`}, '09121234534', 'ask', now(), 'v1')`
        const [other] = await seed`insert into galleries(slug, name_en, name_fa) values (${`other-${id}`}, 'Other gallery', 'گالری دیگر') returning id`
        await seed`insert into leads(gallery_id, phone, kind, consent_at, consent_text_version) values (${other.id}, '09129999999', 'ask', now(), 'v1')`
        await seed`insert into inquiries(gallery_name, contact_person, contact, message, lang, consent_at, consent_text_version) values (${`Inquiry ${id}`}, 'Contact', '09121234567', 'Hello', ${lang}, now(), 'v1')`
      } finally { await seed.end() }
      for (const path of [`/ops/galleries/${slug}/qr`, `/ops/galleries/${slug}/leads`, `/ops/galleries/${slug}/activity`, '/ops/operators', '/ops/inquiries', '/ops/audit', '/ops/health']) {
        await page.goto(path)
        await accessible(page)
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
        await page.screenshot({ path: testInfo.outputPath(`${path.split('/').pop()}.png`) })
      }
      await page.goto(`/ops/galleries/${slug}/leads`)
      await expect(page.locator(`a[href="/ops/galleries/${slug}/leads.csv"]`)).toBeVisible()
      const csvResponse = await page.request.get(`/ops/galleries/${slug}/leads.csv`)
      expect(csvResponse.status()).toBe(200)
      expect(csvResponse.headers()['cache-control']).toBe('no-store')
      expect(csvResponse.headers()['content-disposition']).toContain('attachment; filename=')
      const csv = await csvResponse.text()
      expect(csv).toContain('+989121234534')
      expect(csv).not.toContain('+989129999999')
      await page.goto(`/ops/galleries/${slug}/qr`)
      await page.locator('[name="label"]').fill('Entrance')
      await page.locator('[name="code"]').fill(`entrance-${id}`)
      await page.locator('.ops-form button').click()
      await expect(page.getByText(`entrance-${id}`, { exact: true })).toBeVisible()
      const svg = await page.request.get(`/ops/galleries/${slug}/qr/entrance-${id}/download.svg`)
      expect(svg.status()).toBe(200)
      expect(await svg.text()).toContain('<svg')
      await page.goto('/ops/operators')
      await page.locator('[name="identifier"]').fill(`support-${id}@example.com`)
      await page.locator('.ops-form [name="role"]').selectOption('support')
      await page.locator('button[value="invite"]').click()
      await expect(page.locator('.ops-once textarea')).toBeVisible()
      const supportInvite = await page.locator('.ops-once textarea').inputValue()
      await page.reload()
      await expect(page.locator('.ops-once')).toHaveCount(0)
      const supportContext = await browser.newContext({ baseURL: origin })
      try {
        const supportPage = await supportContext.newPage()
        await supportPage.goto(supportInvite)
        await supportPage.locator('[name="name"]').fill('Support operator')
        await supportPage.locator('[name="password"]').fill('support-password')
        await supportPage.locator('form > button').click()
        await expect(supportPage).toHaveURL(/\/ops$/)
        expect((await supportPage.request.get('/ops/operators')).status()).toBe(403)
        expect((await supportPage.request.post('/ops/operators', { headers: { Origin: origin }, form: { intent: 'invite', identifier: 'blocked@example.com', role: 'admin' } })).status()).toBe(403)
        await supportPage.goto(`/ops/galleries/${slug}/leads`)
        await expect(supportPage.locator('a[download]')).toHaveCount(0)
        expect((await supportPage.request.get(`/ops/galleries/${slug}/leads.csv`)).status()).toBe(403)
        await expect(supportPage.getByText('+98912•••••34', { exact: true })).toBeVisible()
        expect(await supportPage.content()).not.toContain('+989121234534')
        await supportPage.locator('[name="reason"]').fill('Visitor asked for a callback')
        await supportPage.locator('.ops-form button').click()
        await expect(supportPage.locator('.ops-once textarea')).toHaveValue('+989121234534')
        await supportPage.reload()
        await expect(supportPage.locator('.ops-once')).toHaveCount(0)
        const check = postgres(process.env.DATABASE_URL!, { max: 1 })
        try {
          const rows = await check`select summary from audit_logs a join galleries g on g.id = a.gallery_id where g.slug = ${slug} and a.action = 'lead-reveal'`
          expect(rows).toHaveLength(1)
          expect(rows[0].summary).toEqual({ reason: 'Visitor asked for a callback' })
          const exports = await check`select a.summary from audit_logs a join galleries g on g.id = a.gallery_id where g.slug = ${slug} and a.action = 'leads-export'`
          expect(exports).toHaveLength(1)
          expect(exports[0].summary).toEqual({ rows: 1 })
          const [gallery] = await check`select id from galleries where slug = ${slug}`
          await check`insert into leads (gallery_id, phone, kind, consent_at, consent_text_version) values (${gallery.id}, '09125550077', 'ask', now(), '2026-11-01')`
          await supportPage.reload()
          const row = supportPage.locator('.ops-member').filter({ hasText: '+98912•••••34' })
          await row.locator('.ops-lead-delete summary').click()
          await row.locator('[name="deleteReason"]').fill('Visitor asked for deletion')
          await row.locator('.ops-lead-delete button').click()
          await expect(supportPage.getByRole('status')).toBeVisible()
          await expect(supportPage.getByText('+98912•••••34', { exact: true })).toHaveCount(0)
          await expect(supportPage.getByText('+98912•••••77', { exact: true })).toBeVisible()
          const remaining = await check`select phone, consent_text_version from leads where gallery_id = ${gallery.id}`
          expect(remaining.map((lead) => [lead.phone, lead.consent_text_version])).toEqual([['09125550077', '2026-11-01']])
          const deletes = await check`select summary, target_id from audit_logs where gallery_id = ${gallery.id} and action = 'lead-delete'`
          expect(deletes).toHaveLength(1)
          expect(deletes[0].summary).toEqual({ reason: 'Visitor asked for deletion', rows: 1 })
          expect(JSON.stringify(deletes[0])).not.toContain('09121234534')
        } finally { await check.end() }
      } finally { await supportContext.close() }
    })
  }
}

for (const lang of ['fa', 'en'] as const) {
  test(`operator re-enable and gallery error in ${lang}`, async ({ page, baseURL, browser }) => {
    test.setTimeout(180000)
    const origin = baseURL || 'http://127.0.0.1:3000'
    const id = randomUUID().slice(0, 8)
    const email = `ops-${id}@example.com`
    const sql = postgres(process.env.DATABASE_URL!, { max: 1 })
    let invite: string
    try {
      invite = await createOperatorInvite(sql, { email, name: 'Re-enable test operator', role: 'admin', publicAppUrl: origin })
    } finally { await sql.end() }
    await page.setViewportSize({ width: 390, height: 900 })
    await page.context().addCookies([{ name: 'inview-lang', value: lang, url: origin }])
    await page.goto('/ops')
    await expect(page).toHaveURL(/\/ops\/sign-in$/)
    await page.goto(invite)
    await page.locator('input[name="name"]').fill('Re-enable test operator')
    await page.locator('input[name="password"]').fill('operator-password')
    await page.locator('form button[type="submit"], form button:not([type])').click()
    await expect(page).toHaveURL(/\/ops$/)
    await page.goto('/ops/operators')
    const supportEmail = `support-re-${id}@example.com`
    const supportName = `Re-enable support ${id}`
    await page.locator('[name="identifier"]').fill(supportEmail)
    await page.locator('.ops-form [name="role"]').selectOption('support')
    await page.locator('button[value="invite"]').click()
    await expect(page.locator('.ops-once textarea')).toBeVisible()
    const supportInvite = await page.locator('.ops-once textarea').inputValue()
    await page.reload()
    const supportContext = await browser.newContext({ baseURL: origin })
    try {
      const supportPage = await supportContext.newPage()
      await supportPage.goto(supportInvite)
      await supportPage.locator('[name="name"]').fill(supportName)
      await supportPage.locator('[name="password"]').fill('support-password')
      await supportPage.locator('form > button').click()
      await expect(supportPage).toHaveURL(/\/ops$/)
      await page.reload()
      const member = page.locator('.ops-member', { hasText: supportName })
      const userId = await member.locator('input[name="userId"]').inputValue()
      await expect(member).toContainText(lang === 'fa' ? 'فعال' : 'Active')
      await member.locator('button[value="disable"]').click()
      await expect(page.locator('[role="status"]')).toHaveText(lang === 'fa' ? 'ذخیره شد.' : 'Saved.')
      await expect(member).toContainText(lang === 'fa' ? 'غیرفعال' : 'Disabled')
      await member.locator('button[value="enable"]').click()
      await expect(page.locator('[role="status"]')).toHaveText(lang === 'fa' ? 'ذخیره شد.' : 'Saved.')
      await expect(member.locator('button[value="disable"]')).toBeVisible()
      const check = postgres(process.env.DATABASE_URL!, { max: 1 })
      try {
        const rows = await check`select summary from audit_logs where action = 'operator-enable' and target_id = ${userId}`
        expect(rows).toHaveLength(1)
        expect(rows[0].summary).toEqual({ before: { role: 'support', status: 'disabled' }, after: { role: 'support', status: 'active' } })
      } finally { await check.end() }
      await supportPage.goto('/ops/sign-in')
      await supportPage.locator('[name="identifier"]').fill(supportEmail)
      await supportPage.locator('[name="password"]').fill('support-password')
      await supportPage.locator('form > button').click()
      await expect(supportPage).toHaveURL(/\/ops$/)
      await page.goto('/ops/galleries/new')
      await page.locator('[name="slug"]').fill('invite')
      await page.locator('[name="nameFa"]').fill('گالری')
      await page.locator('[name="nameEn"]').fill('Gallery')
      await page.locator('[name="showTitle"]').fill('Show')
      await page.locator('[name="ownerIdentifier"]').fill(`owner-re-${id}@example.com`)
      await page.locator('.ops-form button').click()
      const error = page.locator('.error[role="alert"]')
      await expect(error).toHaveText(lang === 'fa' ? 'این نشانی با صفحه کارکنان تداخل دارد. نشانی دیگری انتخاب کنید.' : 'This slug matches a staff page. Select a different slug.')
      await expect(error).toHaveAttribute('lang', lang)
      await expect(error).toHaveAttribute('dir', lang === 'fa' ? 'rtl' : 'ltr')
    } finally { await supportContext.close() }
  })
}

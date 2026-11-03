import test from 'node:test'
import assert from 'node:assert/strict'
import * as React from 'react'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createRoutesStub, Outlet } from 'react-router'
import GalleryLayout from '../app/pages/gallery/GalleryLayout.tsx'
import { StaffSignIn } from '../app/pages/gallery/StaffSignIn.tsx'
import { renderStaff } from './test-render.ts'

;(globalThis as unknown as { React: typeof React }).React = React

test('the Rooz dashboard renders without the client password gate', () => {
  const Stub = createRoutesStub([
    {
      path: '/dashboard',
      Component: GalleryLayout,
      children: [{ index: true, Component: () => createElement('p', null, 'rooz-demo') }],
    },
  ])
  const html = renderToString(createElement(Stub, { initialEntries: ['/dashboard'] }))
  assert.match(html, /rooz-demo/)
  assert.match(html, /Quiet Rooms/)
  assert.match(html, /Demo/)
  assert.doesNotMatch(html, /href="\/dashboard\/o-gallery"/)
  assert.doesNotMatch(html, /Demo password/)
  assert.doesNotMatch(html, /Dashboard password/)
  assert.doesNotMatch(html, /sessionStorage/)
})

async function renderDashboard(path: string, lang: 'en' | 'fa') {
  const { Overview, ArtworkInterest, Audience } = await import('../app/pages/gallery/Dashboard.tsx')
  const Import = (await import('../app/pages/gallery/Import.tsx')).default
  const Plans = (await import('../app/pages/gallery/Plans.tsx')).default
  const Stub = createRoutesStub([
    {
      id: 'root',
      path: '/',
      Component: () => createElement(Outlet),
      children: [
        {
          path: 'dashboard',
          Component: GalleryLayout,
          children: [
            { index: true, Component: Overview },
            { path: 'artworks', Component: ArtworkInterest },
            { path: 'audience', Component: Audience },
            { path: 'website', Component: Import },
            { path: 'plans', Component: Plans },
          ],
        },
      ],
    },
  ])
  return renderToString(
    createElement(Stub, {
      initialEntries: [path],
      hydrationData: { loaderData: { root: { lang, dir: lang === 'fa' ? 'rtl' : 'ltr' } } },
    }),
  )
}

test('the Rooz dashboard renders in Persian, right to left, with Intl numbers and the Jalali calendar', async () => {
  const report = await renderDashboard('/dashboard', 'fa')
  assert.match(report, /dir="rtl"/)
  assert.match(report, /اتاق‌های آرام/)
  assert.match(report, /۲۴ مهر تا ۸ آبان ۱۴۰۵/)
  assert.match(report, /۱٬۰۴۰/)
  assert.match(report, /جمعه ۲۴/)
  assert.match(report, /نمونه نمایشی/)
  assert.doesNotMatch(report, /Quiet Rooms|Show report|Suggested next step/)

  const artworks = await renderDashboard('/dashboard/artworks', 'fa')
  assert.match(artworks, /بهزاد مردعلی/)
  assert.match(artworks, /۴۸۰٬۰۰۰٬۰۰۰/)
  assert.match(artworks, /۱ دقیقه و ۴۱ ثانیه/)

  const audience = await renderDashboard('/dashboard/audience', 'fa')
  assert.match(audience, /بازدیدکننده نمونه ۱/)
  assert.match(audience, /مجموعه‌دار باسابقه/)

  const website = await renderDashboard('/dashboard/website', 'fa')
  assert.match(website, /نمونه: این ورود اطلاعات شبیه‌سازی است/)

  const plans = await renderDashboard('/dashboard/plans', 'fa')
  assert.match(plans, /۲٬۵۰۰٬۰۰۰/)
  assert.match(plans, /از ۱۲٬۰۰۰٬۰۰۰/)
  assert.match(plans, /رایگان/)
})

test('the Rooz dashboard keeps its English copy and number format', async () => {
  const artworks = await renderDashboard('/dashboard/artworks', 'en')
  assert.match(artworks, /480,000,000/)
  assert.match(artworks, /1m 41s/)
  assert.match(artworks, /1m 05s/)
  const plans = await renderDashboard('/dashboard/plans', 'en')
  assert.match(plans, /2,500,000/)
  assert.match(plans, /from 12,000,000/)
  assert.match(plans, /Always free/)
})

test('the staff sign-in form posts to the server and does not show a demo password', () => {
  const html = renderStaff(createElement(StaffSignIn, { mode: 'code' }), 'en')
  assert.match(html, /method="post"/)
  assert.match(html, /name="accessCode"/)
  assert.match(html, /Open the editor/)
  assert.match(html, /Gallery access code/)
  assert.doesNotMatch(html, /Demo password/)
  assert.doesNotMatch(html, /sessionStorage/)
})

test('the staff sign-in page shows one way to sign in at a time, and the logo goes home', () => {
  const account = renderStaff(createElement(StaffSignIn), 'en')
  assert.match(account, /name="identifier"/)
  assert.doesNotMatch(account, /name="accessCode"/)
  assert.match(account, /href="\/staff\/forgot-password"/)
  assert.match(account, /class="brand gate-brand"[^>]*href="\/"|href="\/"[^>]*class="brand gate-brand"/)
  const code = renderStaff(createElement(StaffSignIn, { mode: 'code', next: '/staff/style' }), 'en')
  assert.doesNotMatch(code, /name="identifier"/)
  assert.match(code, /href="\/staff\/sign-in\?next=%2Fstaff%2Fstyle"/)
})

test('the staff sign-in page renders in Persian from the root language', () => {
  const html = renderStaff(createElement(StaffSignIn, { error: 'wrong', mode: 'code' }), 'fa')
  assert.match(html, /dir="rtl"/)
  assert.match(html, /کد دسترسی گالری/)
  assert.match(html, /باز کردن ویرایشگر/)
  assert.match(html, /اطلاعات ورود درست نیست/)
})

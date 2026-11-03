import test from 'node:test'
import assert from 'node:assert/strict'
import * as React from 'react'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createRoutesStub } from 'react-router'
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

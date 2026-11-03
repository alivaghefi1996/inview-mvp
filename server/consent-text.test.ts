import test from 'node:test'
import assert from 'node:assert/strict'
import { CONSENT_TEXT_VERSION, PRIVACY_PATH, consentText, privacyPage } from '../app/lib/consent.ts'

test('consent and privacy text exists in English and Persian', () => {
  assert.equal(CONSENT_TEXT_VERSION, '2026-11-02')
  for (const lang of ['en', 'fa'] as const) {
    assert.ok(consentText[lang].privacy.length > 0)
    assert.ok(consentText[lang].consent.length > 0)
    assert.ok(consentText[lang].needConsent.length > 0)
  }
  assert.notEqual(consentText.en.privacy, consentText.fa.privacy)
  assert.notEqual(consentText.en.consent, consentText.fa.consent)
  assert.match(consentText.en.privacy, /Save/)
  assert.match(consentText.en.privacy, /Ask/)
  assert.match(consentText.fa.privacy, /ذخیره/)
  assert.match(consentText.fa.privacy, /بپرسید/)
  for (const line of [consentText.en.privacy, consentText.en.consent]) {
    assert.match(line, /gallery/)
    assert.match(line, /Inview/)
  }
  for (const line of [consentText.fa.privacy, consentText.fa.consent]) {
    assert.match(line, /گالری/)
    assert.match(line, /اینویو/)
  }
})

test('the privacy page names who receives the number and how to ask for deletion', () => {
  assert.equal(PRIVACY_PATH, '/privacy')
  for (const lang of ['en', 'fa'] as const) {
    assert.equal(privacyPage[lang].sections.length, 4)
    const page = JSON.stringify(privacyPage[lang])
    assert.ok(!/iran|ایران/i.test(page))
    assert.ok(!/@/.test(page))
  }
  assert.match(JSON.stringify(privacyPage.en), /Inview operators/)
  assert.match(JSON.stringify(privacyPage.en), /Contact the gallery/)
  assert.match(JSON.stringify(privacyPage.fa), /گردانندگان اینویو/)
  assert.match(JSON.stringify(privacyPage.fa), /با گالری/)
})

// The server accepts only this version. Change it when the sentences change.
export const CONSENT_TEXT_VERSION = '2026-11-02'

export const CONSENT_STALE_CODE = 'consent-stale'

export const PRIVACY_PATH = '/privacy'

export const INQUIRY_CONSENT_VERSION = '2026-11-02'

export const consentText = {
  en: {
    privacy:
      'Save sends your mobile number and the saved work to this gallery and to Inview. Ask sends your mobile number and the work you ask about to this gallery and to Inview.',
    consent: 'I agree. This gallery and Inview may store my mobile number with this work until I ask for its deletion.',
    needConsent: 'Agree to store your mobile number before you continue.',
    privacyLink: 'Read the privacy page',
    stale: 'The gallery did not receive your number, because the consent text changed. Reload this page and agree to the new text.',
    reload: 'Reload',
  },
  fa: {
    privacy:
      'اگر اثری را ذخیره کنید، این گالری و اینویو شماره موبایل شما و آن اثر را دریافت می‌کنند. اگر درباره اثری بپرسید، این گالری و اینویو شماره موبایل شما و آن اثر را دریافت می‌کنند.',
    consent: 'موافقم که این گالری و اینویو شماره موبایل من را همراه این اثر نگه دارند تا زمانی که حذف آن را بخواهم.',
    needConsent: 'برای ادامه، ذخیره شماره موبایل را بپذیرید.',
    privacyLink: 'خواندن صفحه حریم خصوصی',
    stale: 'گالری شماره شما را دریافت نکرد، چون متن رضایت تغییر کرده است. این صفحه را دوباره باز کنید و متن تازه را بپذیرید.',
    reload: 'بارگذاری دوباره',
  },
}

export const privacyPage = {
  en: {
    title: 'Privacy',
    description: 'Who receives your mobile number on Inview, how long it stays and how to ask for its deletion.',
    intro: 'This page explains what happens to your mobile number when you save a work or ask about a work.',
    sections: [
      {
        heading: 'What is stored',
        body: 'Your mobile number, the work, whether you saved or asked, the time and the consent text you agreed to. Your saved works and stamps on My Inview stay in your browser. Visit counts use a random id from your browser and do not use your number.',
      },
      {
        heading: 'Who receives your number',
        body: 'The gallery where you gave your number can see it. Inview operators, who run this service, can also receive it. Operators see a masked number. An operator must record a reason to see one full number, and an Inview administrator can export the list of a gallery.',
      },
      {
        heading: 'How long your number stays',
        body: 'Your number stays until you ask for its deletion. It is not verified with a code.',
      },
      {
        heading: 'How to ask for deletion',
        body: 'Contact the gallery where you gave your number and ask for its deletion. The gallery passes your request to the Inview operators. An operator deletes your number from the list of that gallery and records the deletion without your number. If the gallery exported its list, ask the gallery to delete its copy too.',
      },
    ],
    home: 'Go to the home page',
  },
  fa: {
    title: 'حریم خصوصی',
    description: 'چه کسی شماره موبایل شما را در اینویو دریافت می‌کند، شماره تا چه زمانی می‌ماند و چگونه حذف آن را بخواهید.',
    intro: 'این صفحه توضیح می‌دهد وقتی اثری را ذخیره می‌کنید یا درباره اثری می‌پرسید، شماره موبایل شما چه می‌شود.',
    sections: [
      {
        heading: 'چه چیزی ذخیره می‌شود',
        body: 'شماره موبایل شما، اثر، ذخیره یا پرسش شما، زمان و متن رضایتی که پذیرفته‌اید. آثار ذخیره‌شده و مهرهای شما در «اینویوی من» در مرورگر خودتان می‌ماند. شمارش بازدید از یک شناسه تصادفی مرورگر استفاده می‌کند و شماره شما در آن نیست.',
      },
      {
        heading: 'چه کسی شماره شما را دریافت می‌کند',
        body: 'گالری‌ای که شماره را به آن داده‌اید شماره را می‌بیند. گردانندگان اینویو هم که این سرویس را اداره می‌کنند می‌توانند آن را دریافت کنند. گردانندگان شماره را پوشیده می‌بینند. هر گرداننده برای دیدن یک شماره کامل باید دلیل ثبت کند، و مدیر اینویو می‌تواند فهرست یک گالری را خروجی بگیرد.',
      },
      {
        heading: 'شماره شما تا چه زمانی می‌ماند',
        body: 'شماره شما تا زمانی می‌ماند که حذف آن را بخواهید. این شماره با کد تأیید نمی‌شود.',
      },
      {
        heading: 'چگونه حذف شماره را بخواهید',
        body: 'با گالری‌ای که شماره را به آن داده‌اید تماس بگیرید و حذف آن را بخواهید. گالری درخواست شما را به گردانندگان اینویو می‌رساند. گرداننده شماره شما را از فهرست آن گالری حذف می‌کند و این کار را بدون شماره شما ثبت می‌کند. اگر گالری از فهرست خود خروجی گرفته است، از گالری بخواهید نسخه خود را هم حذف کند.',
      },
    ],
    home: 'رفتن به صفحه اصلی',
  },
}

export function leadBody(input: {
  phone: string
  kind: 'save' | 'ask'
  workId: string
  visitorId: string
}) {
  return {
    op: 'lead' as const,
    kind: input.kind,
    phone: input.phone,
    visitorId: input.visitorId,
    workId: input.workId,
    consent: true as const,
    consentTextVersion: CONSENT_TEXT_VERSION,
  }
}

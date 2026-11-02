// All demo content lives here. Edit this file to change the gallery, the show,
// the artworks or the dashboard numbers. Prices and statistics are illustrative.

export type Status = 'available' | 'reserved' | 'sold'

export interface Artwork {
  id: string
  artist: string
  artistFa?: string
  title?: string
  titleFa?: string
  medium: string
  mediumFa: string
  size: string
  year: string
  price: number // Toman
  status: Status
  image: string
  width: number
  height: number
  alt: string
  views: number
  avgSeconds: number
  saves: number
  inquiries: number
  signal: 'sold' | 'hot' | 'quiet' | 'low'
  signalText: string
  signalTextFa: string
}

export const gallery = {
  slug: 'rooz-gallery',
  name: 'Rooz Gallery',
  nameFa: 'گالری روز',
  address: 'Example address, Tehran',
  addressFa: 'نشانی نمونه، تهران',
  hours: 'Open daily, 4–8 pm',
  hoursFa: 'هر روز، ساعت ۱۶ تا ۲۰',
  instagram: 'roozgallery',
  phone: '+98 21 0000 0000',
}

export const show = {
  title: 'Quiet Rooms',
  titleFa: 'اتاق‌های آرام',
  kind: 'Group exhibition',
  kindFa: 'نمایشگاه گروهی',
  dates: '16–30 Oct 2026',
  datesFa: '۲۴ مهر تا ۸ آبان ۱۴۰۵',
  text:
    'Quiet Rooms brings together seven artists working between figure and landscape. ' +
    'Some works crowd the frame with people and noise; others empty it out until only colour and gesture remain. ' +
    'Together they ask what we keep from a room once we have left it.',
  textFa:
    '«اتاق‌های آرام» هفت هنرمند را گرد هم می‌آورد که میان پیکره و منظره کار می‌کنند. ' +
    'برخی آثار قاب را از آدم‌ها و هیاهو پر می‌کنند و برخی دیگر آن را خالی می‌کنند تا فقط رنگ و حرکت بماند. ' +
    'این آثار با هم می‌پرسند پس از ترک یک اتاق، چه چیزی از آن با ما می‌ماند.',
}

export const artworks: Artwork[] = [
  { id: 'mardali-tree', artist: 'Behzad Mardali', artistFa: 'بهزاد مردعلی', medium: 'Acrylic on canvas', mediumFa: 'اکریلیک روی بوم', size: '100 × 120 cm', year: '2025',
    price: 480_000_000, status: 'available', image: '/artworks/mardali1.jpg', width: 732, height: 877, alt: 'A golden tree with red branches on a blue and violet ground',
    views: 341, avgSeconds: 101, saves: 57, inquiries: 6, signal: 'hot', signalText: 'High interest, unsold', signalTextFa: 'علاقه زیاد، فروش‌نرفته' },
  { id: 'mardali-landscape', artist: 'Behzad Mardali', artistFa: 'بهزاد مردعلی', medium: 'Acrylic on canvas', mediumFa: 'اکریلیک روی بوم', size: '200 × 120 cm', year: '2025',
    price: 640_000_000, status: 'available', image: '/artworks/mardali2.jpg', width: 1200, height: 725, alt: 'Trees in red, pink and turquoise across a wide landscape',
    views: 254, avgSeconds: 65, saves: 38, inquiries: 2, signal: 'hot', signalText: 'High interest, unsold', signalTextFa: 'علاقه زیاد، فروش‌نرفته' },
  { id: 'emami-subjectivity', artist: 'Hamid Emami', artistFa: 'حمید امامی', title: 'Subjectivity', titleFa: 'سوبژکتیویته', medium: 'Bronze', mediumFa: 'برنز', size: '64 × 28 × 47 cm', year: '2021',
    price: 520_000_000, status: 'sold', image: '/artworks/emami.jpg', width: 1086, height: 1180, alt: 'A polished bronze sculpture of a twisting, stretching figure',
    views: 412, avgSeconds: 108, saves: 88, inquiries: 11, signal: 'sold', signalText: 'Sold on day 3', signalTextFa: 'روز سوم فروخته شد' },
  { id: 'fateh-face', artist: 'Hamid Fateh', artistFa: 'حمید فاتح', medium: 'Acrylic on cardboard', mediumFa: 'اکریلیک روی مقوا', size: '100 × 70 cm', year: '1403',
    price: 360_000_000, status: 'sold', image: '/artworks/fateh.jpg', width: 918, height: 1200, alt: 'A close, expressive portrait of a face in pinks and browns',
    views: 366, avgSeconds: 92, saves: 64, inquiries: 9, signal: 'sold', signalText: 'Sold at the opening', signalTextFa: 'در افتتاحیه فروخته شد' },
  { id: 'bakhtiari-abstract', artist: 'Firouzeh Bakhtiari', artistFa: 'فیروزه بختیاری', medium: 'Acrylic on canvas', mediumFa: 'اکریلیک روی بوم', size: '80 × 80 cm', year: '1403',
    price: 290_000_000, status: 'available', image: '/artworks/bakhtiari.jpg', width: 1080, height: 1128, alt: 'Loose brushstrokes of magenta and violet over ochre and pale green',
    views: 298, avgSeconds: 72, saves: 55, inquiries: 1, signal: 'quiet', signalText: 'Saved, few inquiries', signalTextFa: 'ذخیره زیاد، پرسش کم' },
  { id: 'darijani-clown', artist: 'Mina Darijani', artistFa: 'مینا دریجانی', medium: 'Mixed media on paper', mediumFa: 'تکنیک ترکیبی روی کاغذ', size: '30 × 42 cm', year: '2026',
    price: 65_000_000, status: 'reserved', image: '/artworks/darijani.jpg', width: 1200, height: 828, alt: 'A smiling clown face over fields of white and black paint',
    views: 276, avgSeconds: 58, saves: 41, inquiries: 4, signal: 'hot', signalText: 'High interest, unsold', signalTextFa: 'علاقه زیاد، فروش‌نرفته' },
  { id: 'khanmirza-cafe', artist: 'Negin Khanmirza', artistFa: 'نگین خان‌میرزا', medium: 'Color pencil on cardboard', mediumFa: 'مداد رنگی روی مقوا', size: '100 × 40 cm', year: '1403',
    price: 58_000_000, status: 'available', image: '/artworks/khanmirza.jpg', width: 1200, height: 456, alt: 'A crowded café scene drawn in blue colour pencil',
    views: 188, avgSeconds: 44, saves: 21, inquiries: 0, signal: 'quiet', signalText: 'Saved, no inquiries', signalTextFa: 'ذخیره شده، بدون پرسش' },
  { id: 'alaeinezhad-riders', artist: 'Mehdi Alaeinezhad', artistFa: 'مهدی علائی‌نژاد', medium: 'Acrylic on canvas', mediumFa: 'اکریلیک روی بوم', size: '35 × 35 cm', year: '1404',
    price: 140_000_000, status: 'available', image: '/artworks/alaeinezhad.jpg', width: 1191, height: 1200, alt: 'Horses and riders in earth tones and black',
    views: 74, avgSeconds: 21, saves: 3, inquiries: 0, signal: 'low', signalText: 'Low visibility: check the hanging spot', signalTextFa: 'دیده‌شدن کم: جای نصب را بررسی کنید' },
]

export const artists = Array.from(new Set(artworks.map((a) => a.artist)))

// Dashboard numbers (illustrative)
export const report = {
  dayOf: 8,
  days: 15,
  funnel: [
    { label: 'Scanned', labelFa: 'اسکن کردند', value: 1040 },
    { label: 'Looked at 3+ works', labelFa: 'دست‌کم ۳ اثر را دیدند', value: 650 },
    { label: 'Signed in', labelFa: 'وارد شدند', value: 262 },
    { label: 'Saved a work', labelFa: 'اثری را ذخیره کردند', value: 160 },
    { label: 'Asked about a work', labelFa: 'درباره اثری پرسیدند', value: 36 },
    { label: 'Bought', labelFa: 'خرید کردند', value: 2 },
  ],
  saves: 350,
  scansPerDay: [
    { date: '2026-10-16', value: 412, friday: true },
    { date: '2026-10-17', value: 58 },
    { date: '2026-10-18', value: 47 },
    { date: '2026-10-19', value: 52 },
    { date: '2026-10-20', value: 44 },
    { date: '2026-10-21', value: 69 },
    { date: '2026-10-22', value: 96 },
    { date: '2026-10-23', value: 262, friday: true },
  ],
  vsLastShow: 18,
  personas: [
    { label: 'Weekend explorer', labelFa: 'بازدیدکننده آخر هفته', share: 46 },
    { label: 'Art student or artist', labelFa: 'دانشجوی هنر یا هنرمند', share: 21 },
    { label: 'Emerging collector', labelFa: 'مجموعه‌دار نوپا', share: 18 },
    { label: 'Established collector', labelFa: 'مجموعه‌دار باسابقه', share: 7 },
    { label: 'Investor-minded', labelFa: 'خریدار سرمایه‌ای', share: 4 },
    { label: 'Corporate buyer', labelFa: 'خریدار سازمانی', share: 4 },
  ],
  sources: [
    { label: 'Entrance QR code', labelFa: 'کد QR ورودی', share: 52 },
    { label: 'Artwork label QR codes', labelFa: 'کدهای QR کنار آثار', share: 31 },
    { label: 'Shared story cards', labelFa: 'کارت‌های استوری اشتراکی', share: 14 },
    { label: 'Newsletter and SMS', labelFa: 'خبرنامه و پیامک', share: 3 },
  ],
  newVisitors: 68,
  leads: [
    { number: 1, persona: 'Established collector', score: 92, why: 'Saved Behzad Mardali’s 100 × 120 canvas and opened its price 4 times', whyFa: 'بوم 100 × 120 بهزاد مردعلی را ذخیره کرد و 4 بار قیمت آن را دید', contact: 'call' },
    { number: 2, persona: 'Emerging collector', score: 81, why: 'Asked about Mina Darijani’s work on paper and about paying in installments', whyFa: 'درباره اثر روی کاغذ مینا دریجانی و پرداخت اقساطی پرسید', contact: 'message' },
    { number: 3, persona: 'Investor-minded', score: 74, why: 'Saved 3 large works and asked about buy and hold', whyFa: '3 اثر بزرگ را ذخیره کرد و درباره خرید برای نگهداری بلندمدت پرسید', contact: 'call' },
    { number: 4, persona: 'Corporate buyer', score: 69, why: 'Asked about renting 2 works for an office', whyFa: 'درباره اجاره 2 اثر برای دفتر کار پرسید', contact: 'message' },
    { number: 5, persona: 'Weekend explorer', score: 55, why: 'Saved the 200 × 120 landscape and shared the show with 2 friends', whyFa: 'منظره 200 × 120 را ذخیره کرد و نمایشگاه را با 2 دوست به اشتراک گذاشت', contact: 'message' },
  ] as { number: number; persona: string; score: number; why: string; whyFa: string; contact: 'call' | 'message' }[],
  lockedLeads: 19,
}

// Other galleries in the visitor's passport (demo history)
export const passportHistory = ['H', 'S', '0', 'B', 'V', 'O', 'A', 'K', 'N']
export const passportGoal = 20

// Past exhibitions, archived from QR pages
export const pastShows = [
  { title: 'Works on Paper', kind: 'Group exhibition', date: 'Sep 2026', image: '/artworks/darijani.jpg' },
  { title: 'Figure and Field', kind: 'Group exhibition', date: 'Jul 2026', image: '/artworks/fateh.jpg' },
  { title: 'Small Formats', kind: 'Group exhibition', date: 'May 2026', image: '/artworks/alaeinezhad.jpg' },
  { title: 'Annual Show 1404', kind: 'Group exhibition', date: 'Mar 2026', image: '/artworks/bakhtiari.jpg' },
]

// Simulated AI results for uploaded files
export const importDemo = {
  found: { artworks: 31, artists: 7, shows: 4 },
  files: [
    { name: 'price-list-1404.xlsx', nameFa: 'price-list-1404.xlsx', count: 22, kind: 'works' },
    { name: '12 photos of wall labels', nameFa: '۱۲ عکس از برچسب‌های دیوار', count: 9, kind: 'works' },
    { name: 'instagram-captions.txt', nameFa: 'instagram-captions.txt', count: 4, kind: 'shows' },
    { name: 'old-website-export.zip', nameFa: 'old-website-export.zip', count: 7, kind: 'bios' },
  ] as { name: string; nameFa: string; count: number; kind: 'works' | 'shows' | 'bios' }[],
  rows: [
    { id: 'r1', artworkId: 'mardali-tree', source: 'Excel', sourceFa: 'اکسل', note: 'Duplicate merged', noteFa: 'تکراری ادغام شد', ok: true },
    { id: 'r2', artworkId: 'fateh-face', source: 'Wall-label photo', sourceFa: 'عکس برچسب دیوار', note: 'English name added', noteFa: 'نام انگلیسی اضافه شد', ok: true },
    { id: 'r3', artworkId: 'bakhtiari-abstract', source: 'Wall-label photo', sourceFa: 'عکس برچسب دیوار', note: 'Size read from photo', noteFa: 'اندازه از روی عکس خوانده شد', ok: true },
    { id: 'r4', artworkId: 'darijani-clown', source: 'Instagram', sourceFa: 'اینستاگرام', note: 'Price unclear: check', noteFa: 'قیمت نامشخص است: بررسی کنید', ok: false },
    { id: 'r5', artworkId: 'emami-subjectivity', source: 'Excel', sourceFa: 'اکسل', note: 'Title added: Subjectivity', noteFa: 'عنوان اضافه شد: سوبژکتیویته', ok: true },
    { id: 'r6', artworkId: 'alaeinezhad-riders', source: 'Old website', sourceFa: 'وب‌سایت قبلی', note: 'No price found: add', noteFa: 'قیمتی پیدا نشد: وارد کنید', ok: false },
  ],
}

// Plans in Toman, excluding VAT. Annual = 10 months.
export const plans = [
  { name: 'Show', nameFa: 'نمایش', tag: 'QR page only', tagFa: 'فقط صفحه QR', monthly: 0, annual: 0, from: false,
    address: 'inview.moshes.io/g/name', addressFa: 'inview.moshes.io/g/name',
    features: ['A QR page for every show', 'Works and price list', 'Scan count'],
    featuresFa: ['یک صفحه QR برای هر نمایشگاه', 'آثار و فهرست قیمت', 'شمار اسکن‌ها'] },
  { name: 'Website', nameFa: 'وب‌سایت', tag: 'Gallery website', tagFa: 'وب‌سایت گالری', monthly: 2_500_000, annual: 25_000_000, from: false,
    address: 'Gallery website', addressFa: 'وب‌سایت گالری',
    features: ['Website from editable templates', 'Import from your files, with cleanup', 'Inview archives each show when it closes', 'Visitor funnel per show', 'Hosting and support included'],
    featuresFa: ['وب‌سایت از قالب‌های قابل ویرایش', 'ورود اطلاعات از فایل‌های شما، با مرتب‌سازی', 'اینویو هر نمایشگاه را پس از پایان بایگانی می‌کند', 'قیف بازدیدکنندگان برای هر نمایشگاه', 'میزبانی و پشتیبانی همراه است'] },
  { name: 'Growth', nameFa: 'رشد', tag: 'Own domain and leads', tagFa: 'دامنه شخصی و مخاطبان', monthly: 6_000_000, annual: 60_000_000, from: false,
    address: 'Gallery website + own domain', addressFa: 'وب‌سایت گالری + دامنه شخصی',
    features: ['Everything in Website', 'Own domain', 'Ranked leads and audience', 'SMS and newsletters', 'We upload 2 shows a month'],
    featuresFa: ['همه امکانات وب‌سایت', 'دامنه شخصی', 'مخاطبان و بازدیدکنندگان رتبه‌بندی‌شده', 'پیامک و خبرنامه', 'ماهی 2 نمایشگاه را ما بارگذاری می‌کنیم'] },
  { name: 'Pro', nameFa: 'حرفه‌ای', tag: 'Several spaces', tagFa: 'چند فضا', monthly: 12_000_000, annual: 120_000_000, from: true,
    address: 'Own domain', addressFa: 'دامنه شخصی',
    features: ['Custom design for several spaces', 'Collector management', 'Loyalty and sales tools', 'We upload every show', 'A named Inview contact'],
    featuresFa: ['طراحی اختصاصی برای چند فضا', 'مدیریت مجموعه‌داران', 'ابزار وفاداری و فروش', 'همه نمایشگاه‌ها را ما بارگذاری می‌کنیم', 'یک رابط مشخص در اینویو'] },
]

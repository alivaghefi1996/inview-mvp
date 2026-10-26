// All demo content lives here. Edit this file to change the gallery, the show,
// the artworks or the dashboard numbers. Prices and statistics are illustrative.

export type Status = 'available' | 'reserved' | 'sold'

export interface Artwork {
  id: string
  artist: string
  artistFa?: string
  title?: string
  medium: string
  mediumFa: string
  size: string
  year: string
  price: number // Toman
  status: Status
  image: string
  alt: string
  // demo dashboard numbers
  views: number
  avgTime: string
  saves: number
  inquiries: number
  signal: 'sold' | 'hot' | 'quiet' | 'low'
  signalText: string
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
  dashboardPassword: 'inview',
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
  { id: 'mardali-tree', artist: 'Behzad Mardali', medium: 'Acrylic on canvas', mediumFa: 'اکریلیک روی بوم', size: '100 × 120 cm', year: '2025',
    price: 480_000_000, status: 'available', image: '/artworks/mardali1.jpg', alt: 'A golden tree with red branches on a blue and violet ground',
    views: 341, avgTime: '1m 41s', saves: 57, inquiries: 6, signal: 'hot', signalText: 'High interest, unsold' },
  { id: 'mardali-landscape', artist: 'Behzad Mardali', medium: 'Acrylic on canvas', mediumFa: 'اکریلیک روی بوم', size: '200 × 120 cm', year: '2025',
    price: 640_000_000, status: 'available', image: '/artworks/mardali2.jpg', alt: 'Trees in red, pink and turquoise across a wide landscape',
    views: 254, avgTime: '1m 05s', saves: 38, inquiries: 2, signal: 'hot', signalText: 'High interest, unsold' },
  { id: 'emami-subjectivity', artist: 'Hamid Emami', title: 'Subjectivity', medium: 'Bronze', mediumFa: 'برنز', size: '64 × 28 × 47 cm', year: '2021',
    price: 520_000_000, status: 'sold', image: '/artworks/emami.jpg', alt: 'A polished bronze sculpture of a twisting, stretching figure',
    views: 412, avgTime: '1m 48s', saves: 88, inquiries: 11, signal: 'sold', signalText: 'Sold on day 3' },
  { id: 'fateh-face', artist: 'Hamid Fateh', artistFa: 'حمید فاتح', medium: 'Acrylic on cardboard', mediumFa: 'اکریلیک روی مقوا', size: '100 × 70 cm', year: '1403',
    price: 360_000_000, status: 'sold', image: '/artworks/fateh.jpg', alt: 'A close, expressive portrait of a face in pinks and browns',
    views: 366, avgTime: '1m 32s', saves: 64, inquiries: 9, signal: 'sold', signalText: 'Sold at the opening' },
  { id: 'bakhtiari-abstract', artist: 'Firouzeh Bakhtiari', artistFa: 'فیروزه بختیاری', medium: 'Acrylic on canvas', mediumFa: 'اکریلیک روی بوم', size: '80 × 80 cm', year: '1403',
    price: 290_000_000, status: 'available', image: '/artworks/bakhtiari.jpg', alt: 'Loose brushstrokes of magenta and violet over ochre and pale green',
    views: 298, avgTime: '1m 12s', saves: 55, inquiries: 1, signal: 'quiet', signalText: 'Saved, few inquiries' },
  { id: 'darijani-clown', artist: 'Mina Darijani', medium: 'Mixed media on paper', mediumFa: 'تکنیک ترکیبی روی کاغذ', size: '30 × 42 cm', year: '2026',
    price: 65_000_000, status: 'reserved', image: '/artworks/darijani.jpg', alt: 'A smiling clown face over fields of white and black paint',
    views: 276, avgTime: '0m 58s', saves: 41, inquiries: 4, signal: 'hot', signalText: 'High interest, unsold' },
  { id: 'khanmirza-cafe', artist: 'Negin Khanmirza', medium: 'Color pencil on cardboard', mediumFa: 'مداد رنگی روی مقوا', size: '100 × 40 cm', year: '1403',
    price: 58_000_000, status: 'available', image: '/artworks/khanmirza.jpg', alt: 'A crowded café scene drawn in blue colour pencil',
    views: 188, avgTime: '0m 44s', saves: 21, inquiries: 0, signal: 'quiet', signalText: 'Saved, no inquiries' },
  { id: 'alaeinezhad-riders', artist: 'Mehdi Alaeinezhad', medium: 'Acrylic on canvas', mediumFa: 'اکریلیک روی بوم', size: '35 × 35 cm', year: '1404',
    price: 140_000_000, status: 'available', image: '/artworks/alaeinezhad.jpg', alt: 'Horses and riders in earth tones and black',
    views: 74, avgTime: '0m 21s', saves: 3, inquiries: 0, signal: 'low', signalText: 'Low visibility: check the hanging spot' },
]

export const artists = Array.from(new Set(artworks.map((a) => a.artist)))

// ---- Gallery dashboard (illustrative numbers) ----
export const report = {
  dayOf: 8,
  days: 15,
  funnel: [
    { label: 'Scanned', value: 1040 },
    { label: 'Looked at 3+ works', value: 650 },
    { label: 'Signed in', value: 262 },
    { label: 'Saved a work', value: 160 },
    { label: 'Asked about a work', value: 36 },
    { label: 'Bought', value: 2 },
  ],
  saves: 350,
  scansPerDay: [
    { label: 'Fri 16', value: 412, friday: true },
    { label: 'Sat 17', value: 58 },
    { label: 'Sun 18', value: 47 },
    { label: 'Mon 19', value: 52 },
    { label: 'Tue 20', value: 44 },
    { label: 'Wed 21', value: 69 },
    { label: 'Thu 22', value: 96 },
    { label: 'Fri 23', value: 262, friday: true },
  ],
  vsLastShow: '+18%',
  personas: [
    { label: 'Weekend explorer', share: 46 },
    { label: 'Art student or artist', share: 21 },
    { label: 'Emerging collector', share: 18 },
    { label: 'Established collector', share: 7 },
    { label: 'Investor-minded', share: 4 },
    { label: 'Corporate buyer', share: 4 },
  ],
  sources: [
    { label: 'Entrance QR code', share: 52 },
    { label: 'Artwork label QR codes', share: 31 },
    { label: 'Shared story cards', share: 14 },
    { label: 'Newsletter and SMS', share: 3 },
  ],
  newVisitors: 68,
  leads: [
    { initials: 'SM', name: 'Sara M.', persona: 'Active collector', score: 92, why: 'Saved Behzad Mardali’s 100 × 120 canvas and opened its price 4 times', contact: 'Call' },
    { initials: 'AR', name: 'Ali R.', persona: 'Emerging collector', score: 81, why: 'Asked about Mina Darijani’s work on paper; interested in installments', contact: 'Message' },
    { initials: 'NK', name: 'Neda K.', persona: 'Investor-minded', score: 74, why: 'Saved 3 large works and asked about buy and hold', contact: 'Call' },
    { initials: 'MH', name: 'M. H.', persona: 'Corporate buyer', score: 69, why: 'Asked about renting 2 works for an office', contact: 'Message' },
    { initials: 'PJ', name: 'Parisa J.', persona: 'Weekend explorer', score: 55, why: 'Saved the 200 × 120 landscape and shared the show with 2 friends', contact: 'Message' },
  ],
  lockedLeads: 19,
}

// Other galleries in the visitor's passport (demo history)
export const passportHistory = ['H', 'S', '0', 'B', 'V', 'O', 'A', 'K', 'N']
export const passportGoal = 20

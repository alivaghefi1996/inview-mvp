import { pathToFileURL } from 'node:url'
import postgres from 'postgres'
import sharp from 'sharp'
import {
  countRows,
  displayVariant,
  generateAccessCode,
  hashAccessCode,
  renderArtwork,
  stableUuid,
  storageFromEnv,
  storeImage,
  tomanFromText,
} from './seed-sample.mjs'

export const SAMPLE_100_SLUG = 'sample-100'
const RENDER_CONCURRENCY = 6

export const GALLERY = {
  nameEn: 'Cheshmeh Project Space (demo)',
  nameFa: 'فضای پروژه چشمه (نمونه)',
}

export const SHOW = {
  titleEn: 'Open Call: One Hundred Small Works',
  titleFa: 'فراخوان آزاد: صد اثر کوچک',
  datesEn: '7 November to 19 December 2026',
  datesFa: '۱۶ آبان تا ۲۸ آذر ۱۴۰۵',
  hoursEn: 'Saturday to Thursday, 12:00 to 20:00',
  hoursFa: 'شنبه تا پنجشنبه، ساعت ۱۲ تا ۲۰',
  addressEn: 'No. 7, Sarv Alley, Vali Asr Street, Tehran',
  addressFa: 'تهران، خیابان ولیعصر، کوچه سرو، پلاک ۷',
  textEn:
    'Cheshmeh is an invented project space that shows how Inview holds a large wall. An open call asked for small works on paper and canvas. Twenty artists each sent a series of five, and the show hangs all one hundred in one room. Every name, work and price on these pages is a demo.',
  textFa:
    'چشمه یک فضای پروژه ساختگی است که نشان می‌دهد اینویو یک دیوار بزرگ را چگونه نگه می‌دارد. یک فراخوان آزاد آثار کوچک روی کاغذ و بوم را خواست. بیست هنرمند هر یک مجموعه‌ای پنج‌تایی فرستادند و نمایشگاه همه صد اثر را در یک اتاق می‌آویزد. همه نام‌ها، آثار و قیمت‌های این صفحه‌ها نمونه هستند.',
  startsOn: '2026-11-07',
  endsOn: '2026-12-19',
}

const MEDIA = {
  oil: ['Oil on canvas', 'رنگ روغن روی بوم'],
  acrylic: ['Acrylic on canvas', 'اکریلیک روی بوم'],
  watercolour: ['Watercolour on paper', 'آبرنگ روی کاغذ'],
  screenprint: ['Screenprint on paper', 'چاپ سیلک روی کاغذ'],
  ink: ['Ink on paper', 'مرکب روی کاغذ'],
  gouache: ['Gouache on cardboard', 'گواش روی مقوا'],
  mixed: ['Mixed media on paper', 'تکنیک ترکیبی روی کاغذ'],
}

// Each artist answered the open call with one series of five works.
const SERIES = [
  { artist: ['Nasrin Ahmadi', 'نسرین احمدی'], title: ['Window Count', 'شمارش پنجره'] },
  { artist: ['Hooman Bakhtiari', 'هومن بختیاری'], title: ['Brick Study', 'مطالعه آجر'] },
  { artist: ['Parisa Tavakoli', 'پریسا توکلی'], title: ['Pomegranate Hour', 'ساعت انار'] },
  { artist: ['Siavash Jahangiri', 'سیاوش جهانگیری'], title: ['Night Bus', 'اتوبوس شب'] },
  { artist: ['Maryam Hosseini', 'مریم حسینی'], title: ['Kitchen Light', 'نور آشپزخانه'] },
  { artist: ['Arash Khalili', 'آرش خلیلی'], title: ['Dry Riverbed', 'بستر خشک رود'] },
  { artist: ['Setareh Daneshvar', 'ستاره دانشور'], title: ['Paper Moon', 'ماه کاغذی'] },
  { artist: ['Babak Rastegar', 'بابک رستگار'], title: ['Tile Fragment', 'قطعه کاشی'] },
  { artist: ['Golnaz Zamani', 'گلناز زمانی'], title: ['Mulberry Shade', 'سایه توت'] },
  { artist: ['Mehdi Sattari', 'مهدی ستاری'], title: ['Roof Garden', 'باغ پشت‌بام'] },
  { artist: ['Niloofar Shams', 'نیلوفر شمس'], title: ['Salt Mirror', 'آینه نمک'] },
  { artist: ['Reza Tabatabai', 'رضا طباطبایی'], title: ['Blue Door', 'در آبی'] },
  { artist: ['Sara Ghaffari', 'سارا غفاری'], title: ['Wheat Line', 'خط گندم'] },
  { artist: ['Omid Fattahi', 'امید فتاحی'], title: ['Copper Bowl', 'کاسه مس'] },
  { artist: ['Taraneh Karimi', 'ترانه کریمی'], title: ['Rain on Dust', 'باران بر خاک'] },
  { artist: ['Kamran Lotfi', 'کامران لطفی'], title: ['Quince Season', 'فصل به'] },
  { artist: ['Zohreh Mahdavi', 'زهره مهدوی'], title: ['Thread and Nail', 'نخ و میخ'] },
  { artist: ['Farhad Naderi', 'فرهاد نادری'], title: ['Desert Road', 'جاده کویر'] },
  { artist: ['Yasaman Vahedi', 'یاسمن واحدی'], title: ['Folded Map', 'نقشه تاشده'] },
  { artist: ['Pouya Heydari', 'پویا حیدری'], title: ['Last Light', 'آخرین نور'] },
]

const WORKS_PER_SERIES = 5
const ROMAN = ['I', 'II', 'III', 'IV', 'V']
const PERSIAN_ORDINAL = ['۱', '۲', '۳', '۴', '۵']

// Table lengths share no factor with 5 or 20, so a column does not repeat down the wall.
const MEDIUMS = ['watercolour', 'ink', 'screenprint', 'gouache', 'acrylic', 'oil', 'mixed']
const SIZES = ['21 x 29.7 cm', '30 x 30 cm', '25 x 35 cm', '40 x 30 cm', '20 x 20 cm', '35 x 50 cm', '15 x 21 cm', '50 x 40 cm']
const YEARS = ['2023', '2024', '۱۴۰۴', '2025', '2026', '۱۴۰۵']
const PRICES = [
  '8,400,000', '۱۲٬۵۰۰٬۰۰۰', '6.200.000', '18,000,000', null, '۹۸۰۰۰۰۰',
  '14,750,000', '22,000,000', '۵٬۴۰۰٬۰۰۰', '11,200,000', null, '26,500,000',
  '7,900,000', '۱۶٬۸۰۰٬۰۰۰', '4.500.000', '19,300,000', '۲۸٬۰۰۰٬۰۰۰',
]
const STATUSES = [
  'available', 'available', 'reserved', 'available', 'sold', 'available', 'available',
  'available', 'reserved', 'available', 'sold', 'available', 'available',
]
const SHAPES = [
  [900, 1200, 'blocks', 'jpeg'],
  [1200, 900, 'bands', 'webp'],
  [1000, 1000, 'circles', 'png'],
  [840, 1180, 'arcs', 'jpeg'],
  [1180, 840, 'blocks', 'png'],
  [960, 1280, 'bands', 'jpeg'],
  [1280, 960, 'circles', 'webp'],
  [1024, 768, 'arcs', 'png'],
  [768, 1024, 'blocks', 'webp'],
  [1100, 1100, 'bands', 'png'],
  [880, 1240, 'circles', 'jpeg'],
]

function buildWorks() {
  const works = []
  for (const [seriesIndex, series] of SERIES.entries()) {
    for (let within = 0; within < WORKS_PER_SERIES; within += 1) {
      const index = seriesIndex * WORKS_PER_SERIES + within
      const [width, height, style, format] = SHAPES[index % SHAPES.length]
      works.push({
        id: `s100-w${String(index + 1).padStart(3, '0')}`,
        artist: series.artist,
        title: [`${series.title[0]} ${ROMAN[within]}`, `${series.title[1]} ${PERSIAN_ORDINAL[within]}`],
        medium: MEDIUMS[index % MEDIUMS.length],
        size: SIZES[index % SIZES.length],
        year: YEARS[index % YEARS.length],
        price: PRICES[index % PRICES.length],
        status: STATUSES[index % STATUSES.length],
        image: [1000 + index, width, height, style, format],
      })
    }
  }
  return works
}

export const WORKS = buildWorks()

async function renderLogo() {
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="240" viewBox="0 0 720 240">' +
      '<rect width="720" height="240" fill="#eef1f0"/>' +
      '<path d="M 56 168 q 42 -96 84 0 q 42 96 84 0" fill="none" stroke="#1d3c34" stroke-width="16" stroke-linecap="round"/>' +
      '<circle cx="140" cy="72" r="22" fill="#b9553a"/>' +
      '<rect x="268" y="96" width="396" height="18" fill="#1d3c34"/>' +
      '<rect x="268" y="134" width="252" height="14" fill="#b9553a"/>' +
      '</svg>',
  )
  return sharp(svg).png().toBuffer()
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length)
  let next = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await worker(items[index], index)
    }
  })
  await Promise.all(runners)
  return results
}

async function prepareMedia(storage) {
  const stored = await mapWithConcurrency(WORKS, RENDER_CONCURRENCY, async (work) => {
    const [seed, width, height, style, format] = work.image
    const id = stableUuid(`media:${work.id}`)
    return [work.id, { id, ...(await storeImage(storage, SAMPLE_100_SLUG, id, await renderArtwork(seed, width, height, style, format))) }]
  })
  const logoId = stableUuid('media:sample-100-logo')
  const logo = { id: logoId, ...(await storeImage(storage, SAMPLE_100_SLUG, logoId, await renderLogo())) }
  return { works: new Map(stored), logo }
}

function workRow(work, galleryId, mediaRow, now) {
  return {
    id: work.id,
    gallery_id: galleryId,
    artist: work.artist[0],
    artist_fa: work.artist[1],
    title: work.title[0],
    title_fa: work.title[1],
    medium: MEDIA[work.medium][0],
    medium_fa: MEDIA[work.medium][1],
    size: work.size,
    year: work.year,
    price_toman: tomanFromText(work.price),
    status: work.status,
    sample: false,
    media_id: mediaRow.id,
    image_url: displayVariant(mediaRow.variants, mediaRow.primaryUrl),
    removed_at: null,
    created_at: now,
    updated_at: now,
  }
}

const WORK_COLUMNS = [
  'id', 'gallery_id', 'artist', 'artist_fa', 'title', 'title_fa', 'medium', 'medium_fa', 'size', 'year',
  'price_toman', 'status', 'sample', 'media_id', 'image_url', 'removed_at', 'created_at', 'updated_at',
]

export async function seedSample100({ sql, storage, env = process.env, now = new Date(), log = console.log }) {
  const media = await prepareMedia(storage)
  const workIds = WORKS.map((work) => work.id)
  const configuredCode = typeof env.SAMPLE_100_GALLERY_ACCESS_CODE === 'string' ? env.SAMPLE_100_GALLERY_ACCESS_CODE.trim() : ''
  let printedCode = null

  const counts = await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(742003)`
    const foreignWorks = await tx`
      SELECT w.id FROM works w JOIN galleries g ON g.id = w.gallery_id
      WHERE w.id = ANY(${workIds}) AND g.slug <> ${SAMPLE_100_SLUG}`
    if (foreignWorks.length) throw new Error(`Another gallery owns the work ids ${foreignWorks.map((row) => row.id).join(', ')}.`)

    const [existing] = await tx`SELECT id, access_code_hash FROM galleries WHERE slug = ${SAMPLE_100_SLUG}`
    let accessCodeHash = existing?.access_code_hash ?? null
    if (configuredCode) {
      accessCodeHash = hashAccessCode(configuredCode)
    } else if (!accessCodeHash) {
      printedCode = generateAccessCode()
      accessCodeHash = hashAccessCode(printedCode)
    }

    let galleryId
    if (existing) {
      galleryId = existing.id
      await tx`
        UPDATE galleries SET is_demo = true, name_en = ${GALLERY.nameEn}, name_fa = ${GALLERY.nameFa}, subdomain = NULL,
          logo_media_id = NULL, access_code_hash = ${accessCodeHash}, updated_at = ${now}
        WHERE id = ${galleryId}`
    } else {
      const [created] = await tx`
        INSERT INTO galleries (slug, name_en, name_fa, subdomain, access_code_hash, created_at, updated_at, is_demo)
        VALUES (${SAMPLE_100_SLUG}, ${GALLERY.nameEn}, ${GALLERY.nameFa}, NULL, ${accessCodeHash}, ${now}, ${now}, true)
        RETURNING id`
      galleryId = created.id
    }

    await tx`DELETE FROM leads WHERE gallery_id = ${galleryId}`
    await tx`DELETE FROM visits WHERE show_id IN (SELECT id FROM shows WHERE gallery_id = ${galleryId})`
    await tx`DELETE FROM show_works WHERE show_id IN (SELECT id FROM shows WHERE gallery_id = ${galleryId})`
    await tx`DELETE FROM qr_codes WHERE show_id IN (SELECT id FROM shows WHERE gallery_id = ${galleryId})`
    await tx`DELETE FROM shows WHERE gallery_id = ${galleryId}`
    await tx`DELETE FROM works WHERE gallery_id = ${galleryId}`
    await tx`DELETE FROM media WHERE gallery_id = ${galleryId}`

    const mediaRows = [media.logo, ...media.works.values()].map((row) => ({
      id: row.id,
      gallery_id: galleryId,
      s3_key: row.key,
      width: row.width,
      height: row.height,
      variants: tx.json(row.variants),
    }))
    await tx`INSERT INTO media ${tx(mediaRows, 'id', 'gallery_id', 's3_key', 'width', 'height', 'variants')}`
    await tx`UPDATE galleries SET logo_media_id = ${media.logo.id} WHERE id = ${galleryId}`

    const [show] = await tx`
      INSERT INTO shows (gallery_id, title_en, title_fa, dates_en, dates_fa, hours_en, hours_fa, address_en, address_fa,
        text_en, text_fa, starts_on, ends_on, status, created_at, updated_at)
      VALUES (${galleryId}, ${SHOW.titleEn}, ${SHOW.titleFa}, ${SHOW.datesEn}, ${SHOW.datesFa}, ${SHOW.hoursEn}, ${SHOW.hoursFa},
        ${SHOW.addressEn}, ${SHOW.addressFa}, ${SHOW.textEn}, ${SHOW.textFa}, ${SHOW.startsOn}, ${SHOW.endsOn},
        'published', ${now}, ${now})
      RETURNING id`

    const workRows = WORKS.map((work) => workRow(work, galleryId, media.works.get(work.id), now))
    await tx`INSERT INTO works ${tx(workRows, ...WORK_COLUMNS)}`
    const showWorkRows = WORKS.map((work, order) => ({ show_id: show.id, work_id: work.id, sort_order: order }))
    await tx`INSERT INTO show_works ${tx(showWorkRows, 'show_id', 'work_id', 'sort_order')}`

    return countRows(tx, galleryId)
  })

  if (printedCode) log(`SAMPLE_100_ACCESS_CODE=${printedCode}`)
  return counts
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required.')
  const sql = postgres(url, { max: 1, onnotice: () => {} })
  try {
    const storage = storageFromEnv(process.env)
    const counts = await seedSample100({ sql, storage })
    console.error(`Seeded the ${SAMPLE_100_SLUG} gallery with ${storage.kind} media: ${JSON.stringify(counts)}`)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}

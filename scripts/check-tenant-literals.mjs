import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

// `app/lib/pilot-seed.ts` and `server/gallery-bootstrap.ts` name the pilot gallery to seed it.
const allowed = [
  /\.test\.[cm]?[jt]sx?$/,
  /^app\/data\/.+-seed\.json$/,
  /^app\/lib\/pilot-seed\.ts$/,
  /^server\/gallery-bootstrap\.ts$/,
]

const directories = ['app', 'server']
const files = ['vite.config.ts']

async function scanFile(file) {
  if (allowed.some((pattern) => pattern.test(file))) return []
  const hits = []
  const lines = (await readFile(file, 'utf8')).split('\n')
  for (const [index, line] of lines.entries()) {
    if (/o-gallery|ensureOGalleryTenant/.test(line)) hits.push(`${file}:${index + 1}:${line.trim()}`)
  }
  return hits
}

async function scan(directory) {
  const hits = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.posix.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'e2e') hits.push(...await scan(file))
    } else if (entry.isFile()) {
      hits.push(...await scanFile(file))
    }
  }
  return hits
}

const hits = (await Promise.all([...directories.map(scan), ...files.map(scanFile)])).flat()
if (hits.length) {
  console.error(hits.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Tenant literal check passed on ${[...directories, ...files].join(', ')}.`)
}

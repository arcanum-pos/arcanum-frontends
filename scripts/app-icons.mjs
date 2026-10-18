// The screens' app icons (README, "App icons"): what a phone, tablet or
// computer shows for a screen added to its home screen, dock or start menu,
// and in the browser tab. One set per screen, so a kassa, a waiter's phone
// and a station screen are told apart at a glance. Generated, and the
// results committed (public/icons/): run `node scripts/app-icons.mjs` after
// changing the table below.
//
//   <key>-96.png   favicon (rounded corners)
//   <key>-180.png  apple-touch-icon (iOS, iPadOS, macOS Safari's "Add to Dock")
//   <key>-192.png, <key>-512.png  the manifest's (Android, Chrome/Edge install)
//   <key>.webmanifest  for the screens with `manifest: true`
//
// The square ones are full-bleed — iOS and Android round them themselves —
// with the glyph inside the maskable safe zone (the middle 80% circle).
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'public/icons')

// key: the file names; glyph: a lucide icon (or 'kabouter', the brand);
// colors: the background's gradient, top to bottom; name: under the icon.
// No manifest for selforder and tap: arcanum-bff makes theirs (they open
// one order, or /tap). Instellingen has none of its own: it's part of the
// kassa, so it uses the kassa's.
export const ICONS = [
  { key: 'arcanum', glyph: 'kabouter', colors: ['#3f3f46', '#09090b'], name: 'Arcanum', manifest: true },
  { key: 'admin', glyph: 'layout-dashboard', colors: ['#6366f1', '#3730a3'], name: 'Console', manifest: true },
  { key: 'kassa', glyph: 'receipt-euro', colors: ['#10b981', '#047857'], name: 'Kassa', manifest: true },
  { key: 'waiter', glyph: 'hand-platter', colors: ['#f59e0b', '#b45309'], name: 'Bediening', manifest: true },
  { key: 'station', glyph: 'chef-hat', colors: ['#ef4444', '#991b1b'], name: 'Station', manifest: true },
  { key: 'display', glyph: 'monitor', colors: ['#0ea5e9', '#0369a1'], name: 'Klantscherm', manifest: true },
  { key: 'tap', glyph: 'smartphone-nfc', colors: ['#8b5cf6', '#5b21b6'], name: 'Tap to Pay', manifest: false },
  { key: 'selforder', glyph: 'utensils', colors: ['#ec4899', '#9d174d'], name: 'Bestellen', manifest: false },
]

const SIZE = 512

function background([top, bottom], radius = 0) {
  return `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>`
    + `<rect width="${SIZE}" height="${SIZE}" rx="${radius}" fill="url(#bg)"/>`
}

async function lucideGlyph(name) {
  const file = path.join(root, `node_modules/lucide-react/dist/esm/icons/${name}.mjs`)
  const { __iconData } = await import(pathToFileURL(file).href)
  const attr = (attrs) => Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')
  const glyph = 280
  return `<g transform="translate(${(SIZE - glyph) / 2} ${(SIZE - glyph) / 2}) scale(${glyph / 24})" fill="none" stroke="#fff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">`
    + __iconData.node.map(([tag, attrs]) => `<${tag} ${attr(attrs)}/>`).join('')
    + '</g>'
}

// The brand: src/shared/assets/kabouter.png (black on transparent), white.
async function kabouter() {
  const size = 420
  const png = await sharp(path.join(root, 'src/shared/assets/kabouter.png')).resize(size, size).negate({ alpha: false }).png().toBuffer()
  return `<image x="${(SIZE - size) / 2}" y="${(SIZE - size) / 2}" width="${size}" height="${size}" href="data:image/png;base64,${png.toString('base64')}"/>`
}

async function render(icon, radius, size) {
  const glyph = icon.glyph === 'kabouter' ? await kabouter() : await lucideGlyph(icon.glyph)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${background(icon.colors, radius)}${glyph}</svg>`
  return sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toBuffer()
}

function manifest(icon) {
  // No start_url: the page it was added from (a kassa's ?terminal=…, a
  // console's org). The scope the whole site: from it, a scope would be its
  // folder (/console/org/…/), and the console's other pages outside it.
  return {
    name: icon.name,
    short_name: icon.name,
    scope: '/',
    display: 'standalone',
    background_color: icon.colors[1],
    icons: [
      { src: `/icons/${icon.key}-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `/icons/${icon.key}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `/icons/${icon.key}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

async function main() {
  await mkdir(out, { recursive: true })
  for (const icon of ICONS) {
    await writeFile(path.join(out, `${icon.key}-96.png`), await render(icon, SIZE * 0.22, 96))
    for (const size of [180, 192, 512]) await writeFile(path.join(out, `${icon.key}-${size}.png`), await render(icon, 0, size))
    if (icon.manifest) await writeFile(path.join(out, `${icon.key}.webmanifest`), JSON.stringify(manifest(icon), null, 2) + '\n')
  }
  console.log(`${ICONS.length} icon sets in ${path.relative(root, out)}/`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()

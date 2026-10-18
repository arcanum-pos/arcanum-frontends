// Every screen's app icons (app-icons.mjs): the files its HTML links
// exist, in the sizes they claim — iOS takes no SVG and Android wants a 192
// and a 512 in the manifest, or it falls back to a letter on grey.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(import.meta.dirname, '..')
const pages = readdirSync(root).filter((f) => f.endsWith('.html'))

function pngSize(publicPath: string): string {
  const file = path.join(root, 'public', publicPath)
  expect(existsSync(file), publicPath).toBe(true)
  const png = readFileSync(file)
  return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`
}

function link(html: string, rel: string): string | undefined {
  return html.match(new RegExp(`<link rel="${rel}"[^>]*href="([^"]+)"`))?.[1]
}

describe('app icons', () => {
  it.each(pages)('%s: a favicon and an apple-touch-icon', (page) => {
    const html = readFileSync(path.join(root, page), 'utf8')
    expect(pngSize(link(html, 'icon')!)).toBe('96x96')
    expect(pngSize(link(html, 'apple-touch-icon')!)).toBe('180x180')
  })

  it.each(pages)("%s: its manifest's icons, a maskable one among them", (page) => {
    const href = link(readFileSync(path.join(root, page), 'utf8'), 'manifest')
    // tap, selforder: arcanum-bff makes theirs.
    if (!href?.startsWith('/icons/')) return
    const manifest = JSON.parse(readFileSync(path.join(root, 'public', href), 'utf8'))
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBeUndefined()
    expect(manifest.scope).toBe('/')
    for (const icon of manifest.icons) expect(pngSize(icon.src)).toBe(icon.sizes)
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))
    expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true)
  })

  it("the bff's manifests (tap, a followed order) have their icons here", () => {
    for (const key of ['tap', 'selforder']) for (const size of [192, 512]) expect(pngSize(`/icons/${key}-${size}.png`)).toBe(`${size}x${size}`)
  })
})

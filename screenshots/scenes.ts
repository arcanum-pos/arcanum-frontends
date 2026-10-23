// Scenes shared by the website's screenshots (shots.spec.ts) and the design
// review pack (review-pack.spec.ts): the kassa on a fake backend, the
// spaghetti evening, the console's menu — sample data from sample.ts.
import type { Page, WebSocketRoute } from '@playwright/test'
import { expect } from '@playwright/test'
import { FakeBackend } from '../e2e/fake-backend'
import { ORG_ID, type FakeCatalogAdmin } from '../e2e/fake-catalog-admin'
import { eveningCatalog, line, NAMES, type Lang } from './sample'

// The customer display's QR code (the fake's is a black square): looks like
// one — the three finder squares and the timing lines are real — but the
// rest is a fixed pseudo-random pattern without valid format information,
// so no app can scan it. A screenshot must never carry a payment link.
export function fakeQr(size = 29): string {
  let seed = 7
  const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
  const finder = (x: number, y: number) => {
    for (const [ox, oy] of [[0, 0], [size - 7, 0], [0, size - 7]]) {
      const dx = x - ox
      const dy = y - oy
      if (dx >= -1 && dx <= 7 && dy >= -1 && dy <= 7) {
        if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return 0 // the white ring around it
        return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4) ? 1 : 0
      }
    }
    return null
  }
  const cells: string[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const f = finder(x, y)
      const on = f ?? (x === 6 || y === 6 ? (x + y) % 2 === 0 : random() < 0.5)
      if (on) cells.push(`<rect x="${x + 2}" y="${y + 2}" width="1" height="1"/>`)
    }
  }
  const box = size + 4
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${box}" width="256" height="256" shape-rendering="crispEdges"><rect width="${box}" height="${box}" fill="#fff"/>${cells.join('')}</svg>`
}
export const QR = `data:image/svg+xml,${encodeURIComponent(fakeQr())}`

// The kassa on a fake backend, as kassa-*.spec.ts's fixture sets it up, but
// in the device language `lang` (arcanum-locale).
export async function openKassa(page: Page, backend: FakeBackend, lang: Lang) {
  const sockets: WebSocketRoute[] = []
  await page.routeWebSocket(/\/devices\/connect/, (ws) => {
    sockets.push(ws)
  })
  await page.addInitScript((locale) => {
    localStorage.setItem('arcanum-terminal', JSON.stringify({ terminalId: 'pos-1', role: 'pos', orgId: 'org-e2e', orgName: 'Scouts Kabouterland' }))
    localStorage.setItem('arcanum-locale', locale)
    localStorage.setItem('arcanum-device', JSON.stringify({ id: 'k1', name: { nl: 'Kassa 1', fr: 'Caisse 1', en: 'Till 1' }[locale] }))
  }, lang)
  await page.context().route(/\/(api\/|whoami)/, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const { status, body } = backend.handle(req.method(), url.pathname + url.search, req.postDataJSON?.() ?? null)
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  // Whoever is signed in on the kassa.
  await page.context().route(/\/whoami$/, (route) => route.fulfill({ json: { name: 'Sam Peeters', email: 'sam@example.test' } }))
  await page.goto('/kassa.html')
  await expect(page.getByText(NAMES[lang].ui.quick)).toBeVisible()
}

// The spaghetti evening: three open tabs, one already paid.
export function evening(lang: Lang) {
  const backend = new FakeBackend()
  backend.catalogs = [eveningCatalog(lang)]
  backend.devices.set('pos-1', { terminal_id: 'pos-1', org_id: 'org-e2e', role: 'pos', linked_to: null, name: 'Kassa 1' })
  const [t4, t7, name, terrace] = NAMES[lang].tables
  backend.openTab(t4, [line(lang, 'pils', 2), line(lang, 'cola', 2), line(lang, 'bolo', 2), line(lang, 'kids', 2), line(lang, 'pancake', 2)])
  backend.openTab(t7, [line(lang, 'wine', 2), line(lang, 'veggie', 1), line(lang, 'bolo', 1)])
  backend.openTab(name, [line(lang, 'pils', 1), line(lang, 'bolo', 1), line(lang, 'kids', 3), line(lang, 'cola', 3)])
  const paid = backend.openTab(terrace, [line(lang, 'pils', 4), line(lang, 'bolo', 4), line(lang, 'mousse', 2)])
  backend.resolveCharge(backend.startCharge(paid.id, 'bancontact').id, true)
  // Opened over the evening, on two kassa's.
  const till = { nl: 'Kassa', fr: 'Caisse', en: 'Till' }[lang]
  backend.tabs.forEach((tab, i) => {
    tab.openedAt = new Date(Date.now() - (95 - i * 22) * 60_000).toISOString()
    tab.openedDeviceName = `${till} ${i % 2 ? 2 : 1}`
  })
  return backend
}

// The evening's products and menu, through the fake's own API (as console-catalog.spec.ts does).
export function seedMenu(admin: FakeCatalogAdmin, lang: Lang) {
  const call = (method: string, p: string, body?: unknown): any => {
    const res = admin.handle(method, `/api/organizations/${ORG_ID}${p}`, body ?? null)
    if (res.status >= 300) throw new Error(`${method} ${p} → ${res.status} ${JSON.stringify(res.body)}`)
    return res.body
  }
  const menu = eveningCatalog(lang)
  const catalog = call('POST', '/catalogs', { name: menu.name })
  for (const section of menu.sections) {
    const category = call('POST', '/catalog/categories', { name: section.name })
    const s = call('POST', `/catalogs/${catalog.id}/sections`, { name: section.name })
    for (const entry of section.entries) {
      const product = call('POST', '/catalog/products', { name: entry.name, categoryId: category.id })
      call('POST', `/catalogs/${catalog.id}/entries`, { sectionId: s.id, variantId: product.variants[0].id, priceCents: entry.priceCents })
    }
  }
}


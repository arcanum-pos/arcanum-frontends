// Sample data for the website's screenshots: a scouts group's spaghetti
// evening, named in the screenshot's language (what an organisation in that
// language would type).
import { fakeEntry, type FakeCatalog, type FakeLineInput } from '../e2e/fake-backend'

export type Lang = 'nl' | 'fr' | 'en'
export const LANGS: Lang[] = ['nl', 'fr', 'en']
export const BROWSER_LOCALE: Record<Lang, string> = { nl: 'nl-BE', fr: 'fr-BE', en: 'en-GB' }

interface Names {
  org: string
  catalog: string
  drinks: string
  food: string
  desserts: string
  items: Record<Item, string>
  tables: string[]
  // SumUp readers, by where they stand.
  readers: [string, string]
  // A customer display, as named in the console.
  display: string
  // Kassa buttons (src/apps/kassa/messages) used to get to a screen.
  ui: { overview: string; split: string; quick: string; pay: string }
  // Self-ordering and stations: the event, its ordering modes, the stations.
  event: string
  modes: [string, string]
  kitchen: string
  bar: string
  note: string
}

type Item = 'pils' | 'cola' | 'wine' | 'coffee' | 'bolo' | 'veggie' | 'kids' | 'pancake' | 'mousse'

// Scouts Kabouterland's spaghetti evening — the kind of event Arcanum is for.
export const NAMES: Record<Lang, Names> = {
  nl: {
    org: 'Scouts Kabouterland',
    catalog: 'Spaghettiavond',
    drinks: 'Dranken',
    food: 'Spaghetti',
    desserts: 'Dessert',
    items: { pils: 'Pils', cola: 'Cola', wine: 'Wijn', coffee: 'Koffie', bolo: 'Spaghetti bolognese', veggie: 'Spaghetti veggie', kids: 'Kinderportie', pancake: 'Pannenkoek', mousse: 'Chocomousse' },
    tables: ['Tafel 4', 'Tafel 7', 'Familie Peeters', 'Tafel 12'],
    readers: ['Toog', 'Ingang'],
    display: 'Klantscherm toog',
    ui: { overview: 'Rekeningen', split: 'Splitsen', quick: 'Toog - direct afrekenen', pay: 'Afrekenen' },
    event: 'Spaghettiavond 2026',
    modes: ['Ter plaatse', 'Take-away'],
    kitchen: 'Keuken',
    bar: 'Bar',
    note: 'zonder kaas',
  },
  fr: {
    org: 'Scouts Kabouterland',
    catalog: 'Souper spaghetti',
    drinks: 'Boissons',
    food: 'Spaghetti',
    desserts: 'Dessert',
    items: { pils: 'Pils', cola: 'Coca', wine: 'Vin', coffee: 'Café', bolo: 'Spaghetti bolognaise', veggie: 'Spaghetti végétarien', kids: 'Portion enfant', pancake: 'Crêpe', mousse: 'Mousse au chocolat' },
    tables: ['Table 4', 'Table 7', 'Famille Dubois', 'Table 12'],
    readers: ['Comptoir', 'Entrée'],
    display: 'Écran client comptoir',
    ui: { overview: 'Additions', split: 'Partager', quick: 'Comptoir - payer directement', pay: 'Encaisser' },
    event: 'Souper spaghetti 2026',
    modes: ['Sur place', 'À emporter'],
    kitchen: 'Cuisine',
    bar: 'Bar',
    note: 'sans fromage',
  },
  en: {
    org: 'Scouts Kabouterland',
    catalog: 'Spaghetti dinner',
    drinks: 'Drinks',
    food: 'Spaghetti',
    desserts: 'Dessert',
    items: { pils: 'Lager', cola: 'Cola', wine: 'Wine', coffee: 'Coffee', bolo: 'Spaghetti bolognese', veggie: 'Veggie spaghetti', kids: 'Kids’ portion', pancake: 'Pancake', mousse: 'Chocolate mousse' },
    tables: ['Table 4', 'Table 7', 'The Smiths', 'Table 12'],
    readers: ['Bar', 'Entrance'],
    display: 'Bar customer display',
    ui: { overview: 'Bills', split: 'Split', quick: 'Counter - pay directly', pay: 'Charge' },
    event: 'Spaghetti dinner 2026',
    modes: ['Eat in', 'Take away'],
    kitchen: 'Kitchen',
    bar: 'Bar',
    note: 'no cheese',
  },
}

const PRICES: Record<Item, number> = { pils: 220, cola: 220, wine: 350, coffee: 200, bolo: 1200, veggie: 1200, kids: 700, pancake: 300, mousse: 350 }

// Each item's category (the reports' and the customer display's grouping): its menu group.
const CATEGORY: Record<Item, 'drinks' | 'food' | 'desserts'> = { pils: 'drinks', cola: 'drinks', wine: 'drinks', coffee: 'drinks', bolo: 'food', veggie: 'food', kids: 'food', pancake: 'desserts', mousse: 'desserts' }

export function eveningCatalog(lang: Lang): FakeCatalog {
  const n = NAMES[lang]
  const e = (key: Item) => ({ ...fakeEntry(`v-${key}`, n.items[key], PRICES[key], key), categoryName: n[CATEGORY[key]] })
  return {
    id: 'cat-spaghetti',
    name: n.catalog,
    isDefault: true,
    archived: false,
    sections: [
      { id: 's-drinks', name: n.drinks, entries: [e('pils'), e('cola'), e('wine'), e('coffee')] },
      { id: 's-food', name: n.food, entries: [e('bolo'), e('veggie'), e('kids')] },
      { id: 's-desserts', name: n.desserts, entries: [e('pancake'), e('mousse')] },
    ],
  }
}

export function line(lang: Lang, key: Item, quantity: number): FakeLineInput {
  return { itemCode: key, variantId: `v-${key}`, name: NAMES[lang].items[key], unitPriceCents: PRICES[key], quantity, category: NAMES[lang][CATEGORY[key]] }
}

// The Rapporten page's report, as arcanum-backend would answer it for an evening.
export function salesReport(lang: Lang) {
  const n = NAMES[lang]
  const product = (key: Item, category: string, quantity: number) => ({ name: n.items[key], category, quantity, revenueCents: PRICES[key] * quantity })
  const byProduct = [
    product('bolo', n.food, 96),
    product('pils', n.drinks, 142),
    product('veggie', n.food, 31),
    product('kids', n.food, 38),
    product('wine', n.drinks, 47),
    product('cola', n.drinks, 66),
    product('pancake', n.desserts, 54),
    product('mousse', n.desserts, 29),
    product('coffee', n.drinks, 41),
  ]
  const sum = (rows: { revenueCents: number }[]) => rows.reduce((t, r) => t + r.revenueCents, 0)
  const byCategory = [n.drinks, n.food, n.desserts].map((category) => {
    const rows = byProduct.filter((p) => p.category === category)
    return { category, quantity: rows.reduce((t, r) => t + r.quantity, 0), revenueCents: sum(rows) }
  })
  const revenue = sum(byProduct)
  const drinks = byCategory[0].revenueCents
  return {
    payments: {
      count: 74,
      amountCents: revenue + 3150,
      tipCents: 3150,
      byMethod: [
        { method: 'bancontact', count: 31, amountCents: Math.round(revenue * 0.46) + 1900, tipCents: 1900 },
        { method: 'sumup', count: 22, amountCents: Math.round(revenue * 0.33) + 1250, tipCents: 1250 },
        { method: 'cash', count: 21, amountCents: revenue - Math.round(revenue * 0.46) - Math.round(revenue * 0.33), tipCents: 0 },
      ],
    },
    sales: {
      tabCount: 58,
      revenueCents: revenue,
      byCategory,
      byProduct,
      byVat: [
        { vatRateBp: 2100, revenueCents: drinks, vatCents: Math.round((drinks * 21) / 121) },
        { vatRateBp: 1200, revenueCents: revenue - drinks, vatCents: Math.round(((revenue - drinks) * 12) / 112) },
      ],
    },
    legacy: { count: 0, amountCents: 0, items: {} },
    openTabs: { count: 3, outstandingCents: 4870 },
  }
}

// The evening's payments behind the report's charts: today from 17:30 to
// 22:30, busiest around dinner, adding up to the report's totals per method.
export function salesTransactions(lang: Lang) {
  const { payments } = salesReport(lang)
  const today = new Date()
  today.setHours(17, 30, 0, 0)
  const out: { id: string; amountCents: number; description: string; method: string; items: Record<string, number>; slotId: null; deviceId: null; deviceName: null; userName: null; userEmail: null; eventId: null; tipCents: number; tabId: null; completedAt: string }[] = []
  let i = 0
  for (const m of payments.byMethod) {
    let left = m.amountCents
    let tipLeft = m.tipCents
    for (let k = 0; k < m.count; k++) {
      const last = k === m.count - 1
      // Roughly even amounts, a little apart, whole tens of cents.
      const amount = last ? left : Math.round(((m.amountCents / m.count) * (0.7 + ((k * 37) % 60) / 100)) / 10) * 10
      const tip = last ? tipLeft : Math.min(tipLeft, k % 3 === 0 ? Math.round(m.tipCents / Math.ceil(m.count / 3) / 10) * 10 : 0)
      left -= amount
      tipLeft -= tip
      // Spread over five hours, peaking around 19:45 (a triangular spread).
      const t = (i * 0.618) % 1
      const minutes = Math.round(300 * (t < 0.45 ? Math.sqrt(t * 0.45) : 1 - Math.sqrt((1 - t) * 0.55)))
      out.push({ id: `tx-${i}`, amountCents: amount, description: '', method: m.method, items: {}, slotId: null, deviceId: null, deviceName: null, userName: null, userEmail: null, eventId: null, tipCents: tip, tabId: null, completedAt: new Date(today.getTime() + minutes * 60_000).toISOString() })
      i++
    }
  }
  return out
}

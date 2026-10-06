// Sample data for the website's screenshots: a small café, named in the
// screenshot's language (what an organisation in that language would type).
import { fakeEntry, type FakeCatalog, type FakeLineInput } from '../e2e/fake-backend'

export type Lang = 'nl' | 'fr' | 'en'
export const LANGS: Lang[] = ['nl', 'fr', 'en']
export const BROWSER_LOCALE: Record<Lang, string> = { nl: 'nl-BE', fr: 'fr-BE', en: 'en-GB' }

interface Names {
  catalog: string
  drinks: string
  food: string
  desserts: string
  items: Record<'pils' | 'cola' | 'wine' | 'coffee' | 'spaghetti' | 'croque' | 'fries' | 'dame' | 'pancake', string>
  tables: string[]
  // Kassa buttons (src/apps/kassa/messages) used to get to a screen.
  ui: { overview: string; split: string; quick: string; pay: string }
}

export const NAMES: Record<Lang, Names> = {
  nl: {
    catalog: 'Café',
    drinks: 'Dranken',
    food: 'Eten',
    desserts: 'Desserts',
    items: { pils: 'Pils', cola: 'Cola', wine: 'Huiswijn', coffee: 'Koffie', spaghetti: 'Spaghetti', croque: 'Croque monsieur', fries: 'Portie frietjes', dame: 'Dame blanche', pancake: 'Pannenkoek' },
    tables: ['Tafel 4', 'Tafel 7', 'Jan', 'Terras 2'],
    ui: { overview: 'Rekeningen', split: 'Splitsen', quick: 'Toog — direct afrekenen', pay: 'Afrekenen' },
  },
  fr: {
    catalog: 'Café',
    drinks: 'Boissons',
    food: 'Plats',
    desserts: 'Desserts',
    items: { pils: 'Pils', cola: 'Coca', wine: 'Vin maison', coffee: 'Café', spaghetti: 'Spaghetti', croque: 'Croque-monsieur', fries: 'Portion de frites', dame: 'Dame blanche', pancake: 'Crêpe' },
    tables: ['Table 4', 'Table 7', 'Jean', 'Terrasse 2'],
    ui: { overview: 'Additions', split: 'Partager', quick: 'Comptoir — payer directement', pay: 'Encaisser' },
  },
  en: {
    catalog: 'Café',
    drinks: 'Drinks',
    food: 'Food',
    desserts: 'Desserts',
    items: { pils: 'Lager', cola: 'Cola', wine: 'House wine', coffee: 'Coffee', spaghetti: 'Spaghetti', croque: 'Croque monsieur', fries: 'Fries', dame: 'Dame blanche', pancake: 'Pancake' },
    tables: ['Table 4', 'Table 7', 'John', 'Terrace 2'],
    ui: { overview: 'Bills', split: 'Split', quick: 'Counter — pay directly', pay: 'Charge' },
  },
}

const PRICES = { pils: 250, cola: 250, wine: 400, coffee: 220, spaghetti: 1200, croque: 750, fries: 400, dame: 600, pancake: 450 }

export function cafeCatalog(lang: Lang): FakeCatalog {
  const n = NAMES[lang]
  const e = (key: keyof typeof PRICES) => fakeEntry(`v-${key}`, n.items[key], PRICES[key], key)
  return {
    id: 'cat-cafe',
    name: n.catalog,
    isDefault: true,
    archived: false,
    sections: [
      { id: 's-drinks', name: n.drinks, entries: [e('pils'), e('cola'), e('wine'), e('coffee')] },
      { id: 's-food', name: n.food, entries: [e('spaghetti'), e('croque'), e('fries')] },
      { id: 's-desserts', name: n.desserts, entries: [e('dame'), e('pancake')] },
    ],
  }
}

export function line(lang: Lang, key: keyof typeof PRICES, quantity: number): FakeLineInput {
  return { itemCode: key, name: NAMES[lang].items[key], unitPriceCents: PRICES[key], quantity }
}

// The Rapporten page's report, as arcanum-backend would answer it for an evening.
export function salesReport(lang: Lang) {
  const n = NAMES[lang]
  const product = (key: keyof typeof PRICES, category: string, quantity: number) => ({ name: n.items[key], category, quantity, revenueCents: PRICES[key] * quantity })
  const byProduct = [
    product('pils', n.drinks, 86),
    product('spaghetti', n.food, 23),
    product('wine', n.drinks, 31),
    product('croque', n.food, 14),
    product('cola', n.drinks, 27),
    product('dame', n.desserts, 12),
    product('fries', n.food, 18),
    product('coffee', n.drinks, 22),
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

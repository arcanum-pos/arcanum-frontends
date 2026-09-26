import { fakeEntry } from './fake-backend'
import { expect, panel, test } from './fixtures'

// The kassa sells from a catalog (step 3c): the device's chosen one, else
// the org default. The fake backend prices catalog lines itself, like the
// real one — the kassa's own price is display-only.

const button = (name: string | RegExp) => ({ name, exact: typeof name === 'string' })

test('sells from the catalog: sections, quick quantities, variants', async ({ kassa, backend }) => {
  await expect(kassa.getByRole('heading', { name: 'Bonnen' })).toBeVisible()
  await expect(kassa.getByRole('heading', { name: 'Tochten' })).toBeVisible()

  await kassa.getByRole('button', button('10 × Bon')).click()
  await kassa.getByRole('button', button(/^Fietstocht \(lid\)/)).click()
  await expect(kassa.getByRole('button', button('Afrekenen € 15,00'))).toBeVisible()

  await kassa.getByLabel('Contant').check()
  await kassa.getByRole('button', button('Afrekenen € 15,00')).click()
  await kassa.getByRole('button', button('Bevestig ontvangst contant geld')).click()

  // Lines carry the catalog's name, price and variant code (the legacy
  // transactions.items key reports still read).
  expect(backend.lines.map((l) => [l.name, l.unitPriceCents, l.quantity, l.itemCode])).toEqual([
    ['Bon', 100, 10, 'bon'],
    ['Fietstocht (lid)', 500, 1, 'fietstochtMember'],
  ])
})

test('the server price wins over a stale price shown in the draft', async ({ kassa, backend }) => {
  backend.openTab('Tafel 1')
  await kassa.reload()
  await kassa.getByRole('button', button(/^#1 Tafel 1/)).click()

  // An admin raises the price after this kassa loaded the catalog.
  backend.entry('v-fiets')!.priceCents = 950
  await kassa.getByRole('button', button(/^Fietstocht \(niet-lid\)/)).click()
  await expect(kassa.getByRole('button', button('Afrekenen € 8,00'))).toBeVisible()

  await kassa.getByRole('button', button('Bestelling toevoegen aan rekening')).click()
  await expect(panel(kassa).getByText('1 × Fietstocht (niet-lid)')).toBeVisible()
  await expect(kassa.getByRole('button', button('Afrekenen € 9,50'))).toBeVisible()
})

test('a catalog picked in Instellingen is used by this kassa', async ({ kassa, backend }) => {
  backend.addCatalog('cat-fuif', 'Fuif', [{ id: 's-bar', name: 'Bar', entries: [fakeEntry('v-pils', 'Pils', 250, 'pils')] }])

  await kassa.goto('/settings.html')
  await kassa.getByRole('button', button('Kies Fuif')).click()
  await expect(kassa.getByText('Actief: Fuif')).toBeVisible()

  await kassa.goto('/kassa.html')
  await expect(kassa.getByRole('heading', { name: 'Bar' })).toBeVisible()
  await expect(kassa.getByRole('heading', { name: 'Tochten' })).toHaveCount(0)

  await kassa.getByRole('button', button(/^Pils/)).click()
  await kassa.getByLabel('Contant').check()
  await kassa.getByRole('button', button('Afrekenen € 2,50')).click()
  await kassa.getByRole('button', button('Bevestig ontvangst contant geld')).click()
  expect(backend.lines.map((l) => [l.name, l.unitPriceCents])).toEqual([['Pils', 250]])

  // And back to the org default.
  await kassa.goto('/settings.html')
  await kassa.getByRole('button', button('Kies')).first().click()
  await expect(kassa.getByText('Actief: standaardmenukaart van de organisatie.')).toBeVisible()
})

test('an archived device catalog falls back to the default, with a notice', async ({ kassa, backend }) => {
  backend.addCatalog('cat-fuif', 'Fuif', []).archived = true
  await kassa.evaluate(() => localStorage.setItem('arcanum-catalog', JSON.stringify({ id: 'cat-fuif', name: 'Fuif' })))
  await kassa.reload()

  await expect(kassa.getByText('De gekozen menukaart "Fuif" is niet meer beschikbaar — de standaardmenukaart wordt gebruikt.')).toBeVisible()
  await expect(kassa.getByRole('heading', { name: 'Tochten' })).toBeVisible()
  expect(await kassa.evaluate(() => localStorage.getItem('arcanum-catalog'))).toBeNull()
})

test('no catalog at all: a clear empty state and nothing to sell', async ({ kassa, backend }) => {
  backend.catalogs = []
  await kassa.reload()

  await expect(kassa.getByText('Nog geen menukaart — een beheerder maakt er een in de console.')).toBeVisible()
  // Fooi is no longer something you can sell on its own (since 3d it's a
  // tip on a payment), so there's nothing to pay and no tip to give.
  await expect(kassa.getByRole('button', button('Afrekenen'))).toBeDisabled()
  await expect(kassa.getByLabel('Fooi')).toBeDisabled()
})

test('an entry removed since loading: refused, draft kept, catalog reloaded', async ({ kassa, backend }) => {
  backend.removeEntry('v-fiets-lid')
  await kassa.getByRole('button', button(/^Fietstocht \(lid\)/)).click()
  await kassa.getByLabel('Contant').check()
  await kassa.getByRole('button', button('Afrekenen € 5,00')).click()

  await expect(kassa.getByText('Dit product staat niet (meer) op de menukaart — herlaad de kassa')).toBeVisible()
  expect(backend.tabs).toHaveLength(0)
  // The draft is kept so the cashier sees what was refused …
  await expect(panel(kassa).getByText('Fietstocht (lid)')).toBeVisible()
  // … and the reloaded catalog no longer offers it.
  await expect(kassa.getByRole('button', button(/^Fietstocht \(lid\)/))).toHaveCount(0)
})

test('switching to another catalog drops draft lines that are not on it', async ({ kassa, backend }) => {
  backend.addCatalog('cat-fuif', 'Fuif', [{ id: 's-bar', name: 'Bar', entries: [fakeEntry('v-bon', 'Bon', 100, 'bon')] }])
  await kassa.getByRole('button', button('5 × Bon')).click()
  await kassa.getByRole('button', button(/^Wandeltocht \(niet-lid\)/)).click()

  // Chosen in Instellingen in another window; this kassa notices on focus.
  await kassa.evaluate(() => {
    localStorage.setItem('arcanum-catalog', JSON.stringify({ id: 'cat-fuif', name: 'Fuif' }))
    window.dispatchEvent(new Event('focus'))
  })

  await expect(kassa.getByText('Andere menukaart geladen — 1 lijn die er niet op staat, is uit de bestelling gehaald.')).toBeVisible()
  await expect(panel(kassa).getByText('Wandeltocht')).toHaveCount(0)
  await expect(kassa.getByRole('button', button('Afrekenen € 5,00'))).toBeVisible()
})

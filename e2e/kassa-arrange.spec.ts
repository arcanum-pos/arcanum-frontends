import type { Page } from '@playwright/test'
import { fakeEntry, type FakeBackend } from './fake-backend'
import { expect, test } from './fixtures'

// This till's own arrangement (layout.ts): the tab panel's width (drag the
// divider) and, with "Alles", where the menu's groups go (Indeling aanpassen)
// — kept on the device, per menu.

test.use({ viewport: { width: 1440, height: 900 } })

async function withGroups(kassa: Page, backend: FakeBackend) {
  backend.catalogs[0].sections.push(
    { id: 's-drank', name: 'Drank', entries: [fakeEntry('v-pils', 'Pils', 250, 'pils')] },
    { id: 's-eten', name: 'Eten', entries: [fakeEntry('v-friet', 'Frieten', 400, 'friet')] },
    { id: 's-dessert', name: 'Dessert', entries: [fakeEntry('v-ijs', 'IJs', 300, 'ijs')] }
  )
  await kassa.reload()
  await expect(kassa.getByRole('button', { name: /^Pils/ })).toBeVisible()
}
const columnGroups = (kassa: Page) =>
  kassa.getByTestId('group-column').evaluateAll((cols) => cols.map((c) => [...c.querySelectorAll('[data-group-id]')].map((g) => (g as HTMLElement).dataset.groupId)))

test('the divider: dragged, the tab panel wider or narrower — kept for this till; a double-click puts it back', async ({ kassa }) => {
  const divider = kassa.getByTestId('panel-divider')
  const side = kassa.getByTestId('tab-side')
  const width = async () => Math.round((await side.boundingBox())!.width)
  expect(await width()).toBe(412)
  const box = (await divider.boundingBox())!
  await kassa.mouse.move(box.x + box.width / 2, box.y + 200)
  await kassa.mouse.down()
  await kassa.mouse.move(box.x + box.width / 2 - 120, box.y + 200, { steps: 6 })
  await kassa.mouse.up()
  expect(await width()).toBe(532)
  // WebKit reports a request cut off by the reload as a page error; let them finish.
  await kassa.waitForLoadState('networkidle')
  await kassa.reload()
  expect(await width()).toBe(532)
  // The keyboard too; never past its bounds.
  await divider.focus()
  await kassa.keyboard.press('ArrowRight')
  expect(await width()).toBe(516)
  for (let i = 0; i < 20; i++) await kassa.keyboard.press('Shift+ArrowRight')
  expect(await width()).toBe(340)
  await divider.dblclick()
  expect(await width()).toBe(412)
})

test('arranging the groups: dragged by their grip into another column or place; kept for this till; only with "Alles"', async ({ kassa, backend }) => {
  await withGroups(kassa, backend)
  await kassa.getByTestId('arrange').click()
  await expect(kassa.getByTestId('arrange-bar')).toBeVisible()
  // While arranging, products can't be tapped.
  await expect(kassa.getByRole('button', { name: /^Pils/ })).toBeDisabled()
  const start = await columnGroups(kassa)
  expect(start.flat().sort()).toEqual(['s-dessert', 's-drank', 's-eten', 's-tochten'])

  // Dessert to the top of the first column.
  const grip = kassa.locator('[data-group-id="s-dessert"]').getByTestId('group-grip')
  const target = (await kassa.getByTestId('group-column').first().locator('[data-group-id]').first().boundingBox())!
  const from = (await grip.boundingBox())!
  await kassa.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await kassa.mouse.down()
  await kassa.mouse.move(from.x + from.width / 2, from.y + from.height / 2 - 20, { steps: 4 })
  await kassa.waitForTimeout(100)
  await kassa.mouse.move(target.x + 40, target.y + 8, { steps: 16 })
  await kassa.waitForTimeout(250)
  await kassa.mouse.up()
  // dnd-kit swallows the click right after a drop (on the dropped group); a person pauses anyway.
  await kassa.waitForTimeout(150)
  await kassa.getByRole('button', { name: 'Klaar', exact: true }).click()
  const after = await columnGroups(kassa)
  expect(after[0][0]).toBe('s-dessert')
  await expect(kassa.getByRole('button', { name: /^IJs/ })).toBeEnabled()

  await kassa.reload()
  await expect(kassa.getByTestId('group-columns')).toBeVisible()
  expect((await columnGroups(kassa))[0][0]).toBe('s-dessert')
  // One group chosen: no columns, nothing to arrange.
  await kassa.getByRole('button', { name: 'Drank', exact: true }).click()
  await expect(kassa.getByTestId('group-columns')).toHaveCount(0)
  await expect(kassa.getByTestId('arrange')).toHaveCount(0)
  await kassa.getByRole('button', { name: 'Alles', exact: true }).click()

  // Back to the automatic flow.
  await kassa.getByTestId('arrange').click()
  await kassa.getByRole('button', { name: 'Standaardindeling' }).click()
  await kassa.getByRole('button', { name: 'Klaar', exact: true }).click()
  await expect(kassa.getByTestId('group-columns')).toHaveCount(0)
  expect(await kassa.evaluate(() => localStorage.getItem('arcanum-kassa-layout'))).toBeNull()
})

test('arranging with the keyboard: space picks a group up, the arrows move it, space puts it down', async ({ kassa, backend }) => {
  await withGroups(kassa, backend)
  await kassa.getByTestId('arrange').click()
  const first = (await columnGroups(kassa))[0]
  const grip = kassa.locator(`[data-group-id="${first[0]}"]`).getByTestId('group-grip')
  await grip.focus()
  // A key at a time, as a person presses them (dnd-kit measures in between).
  for (const key of ['Space', 'ArrowDown', 'Space']) {
    await kassa.keyboard.press(key)
    await kassa.waitForTimeout(300)
  }
  await expect.poll(async () => (await columnGroups(kassa))[0]).toEqual([first[1], first[0], ...first.slice(2)])
})

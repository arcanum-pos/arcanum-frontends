import { expect, test } from './console-fixtures'

// Inviting someone on an installation that sent no mail (none set up, or it
// failed — MAIL.md): the console shows the invitation to pass on yourself,
// and a pending member's row can copy it again later.

const MEMBERS = /\/api\/organizations\/[^/]+\/members$/

test('an invite whose mail was not sent shows the invitation to pass on', async ({ console: open, page }) => {
  const members: any[] = []
  await page.route(MEMBERS, async (route) => {
    const req = route.request()
    if (req.method() === 'POST') {
      const { email, role } = req.postDataJSON()
      const member = { id: 'm1', userSub: null, invitedEmail: email, role, status: 'pending', invitedAt: '2026-10-09T10:00:00Z', acceptedAt: null }
      members.push(member)
      return route.fulfill({ status: 201, json: { ...member, mailSent: false, loginUrl: 'https://pos.example.test/login' } })
    }
    return route.fulfill({ json: members })
  })
  await open('/users')
  await page.getByRole('button', { name: 'Lid uitnodigen' }).click()
  await page.getByLabel('E-mailadres').fill('Jan@Example.test')
  await page.getByRole('button', { name: 'Uitnodigen' }).click()

  const dialog = page.getByRole('dialog', { name: 'Uitnodiging doorgeven' })
  await expect(dialog).toContainText('Er is geen uitnodigingsmail naar jan@example.test verstuurd')
  await expect(dialog.getByLabel('Uitnodiging')).toHaveValue(
    [
      'Je bent uitgenodigd om lid te worden van E2E op Arcanum, als kassier.',
      '',
      'Meld je aan om je uitnodiging te activeren: https://pos.example.test/login',
      '',
      'Meld je aan met het e-mailadres jan@example.test.',
    ].join('\n')
  )
  // Clipboard permissions differ per browser: record what gets written.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => void ((window as any).copied = text) },
    })
  })
  await dialog.getByRole('button', { name: 'Kopiëren' }).click()
  await expect(dialog.getByRole('button', { name: 'Gekopieerd' })).toBeVisible()
  expect(await page.evaluate(() => (window as any).copied)).toContain('als kassier.')
  await dialog.getByRole('button', { name: 'Sluiten' }).first().click()
  await expect(dialog).toHaveCount(0)
})

test('a sent invite shows nothing extra; a pending row can still copy it', async ({ console: open, page }) => {
  const pending = { id: 'm2', userSub: null, invitedEmail: 'piet@example.test', role: 'admin', status: 'pending', invitedAt: '2026-10-09T10:00:00Z', acceptedAt: null }
  const active = { ...pending, id: 'm3', userSub: 'someone', invitedEmail: 'an@example.test', role: 'cashier', status: 'active' }
  await page.route(MEMBERS, async (route) => {
    if (route.request().method() === 'POST') {
      const { email, role } = route.request().postDataJSON()
      return route.fulfill({ status: 201, json: { ...pending, id: 'm4', invitedEmail: email, role, mailSent: true } })
    }
    return route.fulfill({ json: [pending, active] })
  })
  await open('/users')
  await page.getByRole('button', { name: 'Lid uitnodigen' }).click()
  await page.getByLabel('E-mailadres').fill('mie@example.test')
  await page.getByRole('button', { name: 'Uitnodigen' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // Only a pending member's menu offers it.
  await page.getByRole('row', { name: /an@example\.test/ }).getByRole('button').click()
  await expect(page.getByRole('menuitem', { name: 'Uitnodiging kopiëren' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await page.getByRole('row', { name: /piet@example\.test/ }).getByRole('button').click()
  await page.getByRole('menuitem', { name: 'Uitnodiging kopiëren' }).click()
  const dialog = page.getByRole('dialog', { name: 'Uitnodiging doorgeven' })
  await expect(dialog).toContainText('Bezorg piet@example.test deze uitnodiging')
  const origin = new URL(page.url()).origin
  await expect(dialog.getByLabel('Uitnodiging')).toHaveValue(new RegExp(`als beheerder\\.\\n\\nMeld je aan om je uitnodiging te activeren: ${origin.replace(/[.:/]/g, '\\$&')}/login\\n`))
})

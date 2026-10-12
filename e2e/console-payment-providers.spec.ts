// Console → Instellingen → Betaalproviders: each provider says in a line what
// it needs (for real and for testing) and links to its guide in the manual.
import { expect, test } from './console-fixtures'

test('each provider explains itself and links to its guide', async ({ console: open, page }) => {
  await open('/settings/payment-providers')
  for (const [text, guide] of [
    ['De klant scant een QR-code', 'bancontact'],
    ['Kaartbetalingen op een SumUp Solo', 'sumup'],
  ] as const) {
    const help = page.getByText(text)
    await expect(help).toBeVisible()
    await expect(help.getByRole('link', { name: 'Meer uitleg' })).toHaveAttribute('href', `https://arcanum.kaboutersoft.be/docs/${guide}`)
  }
})

// A Bancontact key: which account it pays out to is shown to confirm before
// it's kept (arcanum-backend bancontact-account.ts) — a key of someone
// else's account would otherwise go unnoticed.
test("Bancontact: the key's account shown to confirm, then kept and shown on the card", async ({ console: open, page }) => {
  const saved: any[] = []
  let stored: any[] = []
  await page.route(/\/api\/organizations\/[^/]+\/payment-credentials(\/bancontact)?$/, async (route) => {
    const req = route.request()
    if (req.method() === 'GET') return route.fulfill({ json: stored })
    const body = req.postDataJSON()
    saved.push(body)
    const account = { merchantId: 'm-123', name: 'Scouts Kabouterland', iban: 'BE•• •••• •••• 7034' }
    if (body.confirmMerchantId !== 'm-123') return route.fulfill({ status: 409, json: { error: 'x', code: 'bancontact_confirm_account', account } })
    stored = [{ provider: 'bancontact', configured: true, updatedAt: '2026-10-12T10:00:00Z', environment: 'prod', account }]
    return route.fulfill({ json: { provider: 'bancontact', configured: true } })
  })
  await open('/settings/payment-providers')
  const card = page.locator('[data-slot="card"]').filter({ hasText: 'Bancontact' }).first()
  await card.getByRole('button', { name: 'Sleutels instellen' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('testbetaling van €0,01')
  await dialog.getByLabel('API-key').fill('the-key')
  await dialog.getByRole('button', { name: 'Controleren' }).click()
  // Not kept yet: its account first.
  const confirm = dialog.getByTestId('account-confirm')
  await expect(confirm).toContainText('Scouts Kabouterland · BE•• •••• •••• 7034')
  await expect(confirm).toContainText('Merchant ID m-123')
  expect(saved).toEqual([{ apiKey: 'the-key', environment: 'prod' }])
  await dialog.getByRole('button', { name: 'Ja, bewaren' }).click()
  await expect(dialog).toBeHidden()
  expect(saved.at(-1)).toEqual({ apiKey: 'the-key', environment: 'prod', confirmMerchantId: 'm-123' })
  await expect(page.getByTestId('bancontact-account')).toHaveText('Betaalt uit aan: Scouts Kabouterland · BE•• •••• •••• 7034')
})

test('a Bancontact key saved before the check: the card says so', async ({ console: open, page }) => {
  await page.route(/\/api\/organizations\/[^/]+\/payment-credentials$/, (route) =>
    route.fulfill({ json: [{ provider: 'bancontact', configured: true, updatedAt: '2026-10-01T10:00:00Z', environment: 'prod', account: null }] })
  )
  await open('/settings/payment-providers')
  await expect(page.getByTestId('bancontact-account')).toContainText('Niet gecontroleerd')
})

// A test (preprod) key: flagged on the card, and its confirmation says
// Bancontact answers with its own test merchant there.
test('a Bancontact test key: flagged on the card, its test merchant explained, the environment kept', async ({ console: open, page }) => {
  const saved: any[] = []
  let stored: any[] = [{ provider: 'bancontact', configured: true, updatedAt: '2026-10-12T10:00:00Z', environment: 'preprod', account: null }]
  await page.route(/\/api\/organizations\/[^/]+\/payment-credentials(\/bancontact)?$/, async (route) => {
    const req = route.request()
    if (req.method() === 'GET') return route.fulfill({ json: stored })
    const body = req.postDataJSON()
    saved.push(body)
    const account = { merchantId: 'ext-id-bancontact', name: 'Bancontact', iban: 'BE•• •••• •••• 8625' }
    if (body.confirmMerchantId !== account.merchantId) return route.fulfill({ status: 409, json: { error: 'x', code: 'bancontact_confirm_account', account } })
    stored = [{ ...stored[0], account }]
    return route.fulfill({ json: { provider: 'bancontact', configured: true } })
  })
  await open('/settings/payment-providers')
  await expect(page.getByTestId('bancontact-test')).toHaveText('Test (preprod)')
  const card = page.locator('[data-slot="card"]').filter({ hasText: 'Bancontact' }).first()
  await card.getByRole('button', { name: 'Sleutels instellen' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('API-key').fill('test-key')
  await dialog.getByRole('button', { name: 'Controleren' }).click()
  await expect(dialog.getByTestId('account-confirm')).toContainText('Testomgeving: Bancontact gebruikt hier zijn eigen testhandelaar')
  expect(saved).toEqual([{ apiKey: 'test-key', environment: 'preprod' }])
  await dialog.getByRole('button', { name: 'Ja, bewaren' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByTestId('bancontact-test')).toBeVisible()
})

test('a Bancontact production key: no test flag', async ({ console: open, page }) => {
  await page.route(/\/api\/organizations\/[^/]+\/payment-credentials$/, (route) =>
    route.fulfill({ json: [{ provider: 'bancontact', configured: true, updatedAt: '2026-10-01T10:00:00Z', environment: 'prod', account: { merchantId: 'm-1', name: 'X', iban: null } }] })
  )
  await open('/settings/payment-providers')
  await expect(page.getByTestId('bancontact-account')).toBeVisible()
  await expect(page.getByTestId('bancontact-test')).toHaveCount(0)
})

test("SumUp: the merchant code's account shown to confirm, then kept and shown on the card", async ({ console: open, page }) => {
  const saved: any[] = []
  let stored: any[] = []
  await page.route(/\/api\/organizations\/[^/]+\/payment-credentials(\/sumup)?$/, async (route) => {
    const req = route.request()
    if (req.method() === 'GET') return route.fulfill({ json: stored })
    const body = req.postDataJSON()
    saved.push(body)
    const account = { merchantId: 'MABC123', name: 'Scouts Kabouterland' }
    if (body.confirmMerchantId !== 'MABC123') return route.fulfill({ status: 409, json: { error: 'x', code: 'sumup_confirm_account', account } })
    stored = [{ provider: 'sumup', configured: true, updatedAt: '2026-10-12T10:00:00Z', account }]
    return route.fulfill({ json: { provider: 'sumup', configured: true } })
  })
  await open('/settings/payment-providers')
  const card = page.locator('[data-slot="card"]').filter({ hasText: 'SumUp' }).first()
  await card.getByRole('button', { name: 'Sleutels instellen' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Merchant code').fill('MABC123')
  await dialog.getByLabel('API-key').fill('sup_sk')
  await dialog.getByRole('button', { name: 'Controleren' }).click()
  await expect(dialog.getByTestId('account-confirm')).toContainText('Deze merchant code en sleutel horen bij:Scouts Kabouterland')
  await dialog.getByRole('button', { name: 'Ja, bewaren' }).click()
  await expect(dialog).toBeHidden()
  expect(saved).toEqual([{ merchantId: 'MABC123', apiKey: 'sup_sk' }, { merchantId: 'MABC123', apiKey: 'sup_sk', confirmMerchantId: 'MABC123' }])
  await expect(page.getByTestId('sumup-account')).toHaveText('Account: Scouts Kabouterland (merchant code MABC123)')
})

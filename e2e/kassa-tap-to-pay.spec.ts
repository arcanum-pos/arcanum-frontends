// Tap to Pay at the kassa (a kassa without a SumUp reader): the cashier
// picks it, the kassa's phone gets the payment (the backend's business), and
// the kassa shows a QR of the same payment for any phone with the SumUp app.
// SumUp confirms it — never a tap on the kassa; a cancel asks SumUp first.
import { expect, test } from './fixtures'

test('not set up: three methods, no Tap to Pay', async ({ kassa }) => {
  await expect(kassa.getByLabel('SumUp')).toBeVisible()
  await expect(kassa.getByLabel('Tap to Pay')).toHaveCount(0)
})

test("set up, while SumUp can't list the readers: still offered", async ({ kassa, backend }) => {
  backend.tapToPay = true
  backend.readersFail = true
  await kassa.reload()
  await expect(kassa.getByLabel('Tap to Pay')).toBeVisible()
})

test.describe('set up', () => {
  test.beforeEach(async ({ kassa, backend }) => {
    backend.tapToPay = true
    await kassa.reload()
    await expect(kassa.getByLabel('Tap to Pay')).toBeVisible()
  })

  test('a SumUp payment for the app, its QR on the kassa; paid when SumUp says so', async ({ kassa, backend, push }) => {
    await kassa.getByRole('button', { name: '10 × Bon', exact: true }).click()
    await kassa.getByLabel('Tap to Pay').check()
    await kassa.getByRole('button', { name: /^Afrekenen/ }).click()
    await expect.poll(() => backend.charges.length).toBe(1)
    const charge = backend.charges[0]
    expect(charge.body).toMatchObject({ method: 'sumup', app: true, amount: 1000, posTerminalId: 'pos-e2e' })
    expect(charge.body.readerId).toBeUndefined()

    const qr = kassa.getByTestId('tap-qr')
    await expect(qr).toBeVisible()
    await expect(qr).toContainText('De telefoon van deze kassa kreeg een melding')
    await expect(kassa.getByText('Wacht op Tap to Pay op de telefoon')).toBeVisible()
    // Never confirmed by hand.
    await expect(kassa.getByRole('button', { name: /Bevestig/ })).toHaveCount(0)

    // Paid on the phone: SumUp's record resolves it, devicehub tells the kassa.
    backend.resolveCharge(charge.id, true)
    push({ event: 'payment_updated', payment_id: charge.id, method: 'sumup' })
    await expect(kassa.getByText('Betaald (Tap to Pay)')).toBeVisible()
    await expect(qr).toHaveCount(0)
  })

  test('the QR opens the phone page for this payment', async ({ kassa, backend }) => {
    await kassa.getByRole('button', { name: '10 × Bon', exact: true }).click()
    await kassa.getByLabel('Tap to Pay').check()
    await kassa.getByRole('button', { name: /^Afrekenen/ }).click()
    await expect(kassa.getByTestId('tap-qr')).toBeVisible()
    const id = backend.charges[0].id
    await expect(kassa.getByTestId('tap-qr').locator('svg title')).toHaveText('QR-code voor Tap to Pay')
    const origin = new URL(kassa.url()).origin
    await expect(kassa.getByTestId('tap-qr')).toHaveAttribute('data-link', `${origin}/tap?charge=${id}&t=tok-${id}`)
  })

  test('cancelled at the kassa: nothing at SumUp — back to the tab', async ({ kassa, backend }) => {
    await kassa.getByRole('button', { name: '10 × Bon', exact: true }).click()
    await kassa.getByLabel('Tap to Pay').check()
    await kassa.getByRole('button', { name: /^Afrekenen/ }).click()
    await expect(kassa.getByTestId('tap-qr')).toBeVisible()
    await kassa.getByRole('button', { name: 'Betaling annuleren' }).click()
    await expect(kassa.getByTestId('tap-qr')).toHaveCount(0)
    expect(backend.charges[0].status).toBe('failed')
  })

  test('cancelled, but just paid on the phone: it stays paid, and the kassa says so', async ({ kassa, backend }) => {
    backend.tapPaidAtSumup = true
    await kassa.getByRole('button', { name: '10 × Bon', exact: true }).click()
    await kassa.getByLabel('Tap to Pay').check()
    await kassa.getByRole('button', { name: /^Afrekenen/ }).click()
    await expect(kassa.getByTestId('tap-qr')).toBeVisible()
    await kassa.getByRole('button', { name: 'Betaling annuleren' }).click()
    await expect(kassa.getByText('Betaald (Tap to Pay)')).toBeVisible()
    expect(backend.charges[0].status).toBe('succeeded')
  })
})

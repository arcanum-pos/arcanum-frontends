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

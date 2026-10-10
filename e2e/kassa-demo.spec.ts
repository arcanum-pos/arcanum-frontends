import { expect, test } from './fixtures'

// A demo starts on the kassa (the bootstrapper pairs the browser): a bar says
// when it disappears and leads to the console. A real org has no bar.

test('a demo org: when it disappears, and the way to the console', async ({ kassa, backend }) => {
  const at = new Date(Date.now() + 2 * 3600_000)
  backend.demoExpiresAt = at.toISOString()
  await kassa.reload()
  const bar = kassa.getByTestId('demo-bar')
  const hhmm = at.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
  // After midnight (another day) it names the weekday too.
  await expect(bar).toContainText(new RegExp(`Dit is een demo — ze verdwijnt vanzelf om (\\S+ )?${hhmm}\\.`))
  const link = bar.getByRole('link', { name: /Beheer in de console/ })
  await expect(link).toHaveAttribute('href', '/console')
  await expect(link).toHaveAttribute('target', '_blank')
})

test('a real org: no demo bar', async ({ kassa }) => {
  await expect(kassa.getByText('Toog — direct afrekenen')).toBeVisible()
  await expect(kassa.getByTestId('demo-bar')).toHaveCount(0)
})

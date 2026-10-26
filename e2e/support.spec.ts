import { expect, test } from './fixtures'

// The ? button (shared/support): captures the page, collects the metadata,
// opens support.kaboutersoft.be in a dialog and hands both over only once
// the form says it's ready. Here a stand-in form shows what it got.
const FAKE_FORM = `<!doctype html><meta charset="utf-8"><body>
<p id="got">waiting</p><button id="close">Annuleren</button>
<script>
  addEventListener('message', async (e) => {
    if (e.source !== parent || e.data?.type !== 'arcanum-support:context') return;
    const m = e.data.metadata;
    document.getElementById('got').textContent = JSON.stringify({
      lang: new URLSearchParams(location.search).get('lang'),
      embed: new URLSearchParams(location.search).get('embed'),
      origin: e.origin,
      shot: e.data.screenshot instanceof Blob ? e.data.screenshot.type : null,
      shotBytes: e.data.screenshot ? e.data.screenshot.size : 0,
      screen: m.screen, page: m.page, device: m.device, org: m.organization,
      clicks: m.clicks.map((c) => c.target), hasBrowser: !!m.browser.userAgent,
      email: e.data.email ?? null,
    });
  });
  document.getElementById('close').onclick = () => parent.postMessage({ type: 'arcanum-support:close' }, '*');
  parent.postMessage({ type: 'arcanum-support:ready' }, '*');
</script>`

test('? captures the kassa and hands it to the support form, which can close the dialog', async ({ kassa }) => {
  await kassa.route('https://support.kaboutersoft.be/**', (route) => route.fulfill({ contentType: 'text/html', body: FAKE_FORM }))
  await kassa.getByRole('button', { name: 'Alles' }).click()

  const help = kassa.getByTestId('support-button')
  await expect(help).toHaveAccessibleName('Hulp, of een probleem melden')
  await help.click()

  const dialog = kassa.getByRole('dialog', { name: 'Support' })
  await expect(dialog).toBeVisible()
  const got = kassa.frameLocator('[data-testid="support-frame"]').locator('#got')
  await expect(got).not.toHaveText('waiting')
  const data = JSON.parse((await got.textContent())!)
  expect(data).toMatchObject({ lang: 'nl', embed: '1', screen: 'kassa', page: '/kassa.html', shot: 'image/jpeg', hasBrowser: true })
  expect(data.origin).toBe(new URL(kassa.url()).origin)
  expect(data.shotBytes).toBeGreaterThan(5_000)
  expect(data.device.role).toBe('pos')
  expect(data.org.id).toBeTruthy()
  expect(data.clicks).toContain('button: Alles')
  // The ? itself isn't one of the clicks.
  expect(data.clicks.join()).not.toContain('Hulp')
  await expect(help).toBeHidden()

  await kassa.frameLocator('[data-testid="support-frame"]').getByRole('button', { name: 'Annuleren' }).click()
  await expect(dialog).toBeHidden()
  await expect(help).toBeVisible()
})

test("a message from anywhere but the form's own frame is ignored", async ({ kassa }) => {
  await kassa.route('https://support.kaboutersoft.be/**', (route) => route.fulfill({ contentType: 'text/html', body: FAKE_FORM }))
  await kassa.getByTestId('support-button').click()
  const dialog = kassa.getByRole('dialog', { name: 'Support' })
  await expect(dialog).toBeVisible()
  await kassa.evaluate(() => window.postMessage({ type: 'arcanum-support:close' }, '*'))
  await kassa.waitForTimeout(200)
  await expect(dialog).toBeVisible()
  await kassa.getByRole('button', { name: 'Sluiten' }).click()
  await expect(dialog).toBeHidden()
})

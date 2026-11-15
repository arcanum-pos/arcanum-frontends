import type { Page } from '@playwright/test'
import { expect, test } from './console-fixtures'

// Instellingen → Reservekopie (OFFLINE.md): linking a local org to a cloud
// backup and its status; on the cloud, a backup is read-only (banner) and
// a link code is made here. The backend's suite covers the sync itself.

type Status = Record<string, unknown> & { role: 'none' | 'source' | 'replica' }

// The backup routes answered here, before the fixture's fakes.
async function fakeBackup(page: Page, initial: Status) {
  const state = { status: initial, posts: [] as unknown[], invites: 0 }
  await page.route(/\/api\/organizations\/(backups|[^/]+\/backup)$/, async (route) => {
    const req = route.request()
    const reply = (status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (req.url().endsWith('/backups')) {
      state.invites++
      return reply(201, { code: 'arcanum-backup:eyJ1cmwiOiJodHRwczovL2Nsb3VkLnRlc3QiLCJrZXkiOiJ4In0', expiresAt: '2026-11-22T10:00:00Z' })
    }
    if (req.method() === 'GET') return reply(200, state.status)
    if (req.method() === 'POST') {
      state.posts.push(req.postDataJSON())
      if (req.postDataJSON().code === 'wrong') return reply(400, { error: 'Deze koppelcode klopt niet of is verlopen - maak een nieuwe op de cloudinstallatie', code: 'backup_code_invalid' })
      state.status = { role: 'source', remoteUrl: 'https://cloud.test', lastSyncAt: null, lastError: 'unreachable: fetch failed', pending: 120, pendingFirstSync: 118, firstSyncDoneAt: null, protocol: 1, schema: 'abcd1234' }
      return reply(201, state.status)
    }
    if (req.method() === 'DELETE') {
      state.status = { role: 'none', protocol: 1, schema: 'abcd1234' }
      return reply(200, state.status)
    }
    return route.fallback()
  })
  return state
}

test('a local org: paste the code, then how far the backup is, then unlink', async ({ page, console: open }) => {
  const backup = await fakeBackup(page, { role: 'none', protocol: 1, schema: 'abcd1234' })
  await open('/settings/backup')
  await expect(page.getByRole('heading', { name: 'Reservekopie' })).toBeVisible()

  await page.getByLabel('Koppelcode').fill('wrong')
  await page.getByRole('button', { name: 'Koppelen' }).click()
  await expect(page.getByText('Deze koppelcode klopt niet of is verlopen')).toBeVisible()

  await page.getByLabel('Koppelcode').fill('  arcanum-backup:abc  ')
  await page.getByRole('button', { name: 'Koppelen' }).click()
  const card = page.getByTestId('backup-source')
  await expect(card).toContainText('Gekoppeld aan https://cloud.test')
  await expect(card).toContainText('nog 118 rijen te gaan')
  await expect(card).toContainText('120')
  await expect(card.getByRole('alert')).toContainText('De cloud is niet bereikbaar (geen internet?)')
  expect(backup.posts.at(-1)).toEqual({ code: 'arcanum-backup:abc' })

  page.once('dialog', (d) => d.accept())
  await card.getByRole('button', { name: 'Ontkoppelen' }).click()
  await expect(page.getByLabel('Koppelcode')).toBeVisible()
})

test('a backup on the cloud: read-only banner on every page, and its card', async ({ page, console: open }) => {
  await fakeBackup(page, { role: 'replica', lastSyncAt: new Date(Date.now() - 5 * 60_000).toISOString(), protocol: 1, schema: 'abcd1234' })
  await open('/dashboard')
  await expect(page.getByTestId('backup-banner')).toContainText('Reservekopie - alleen lezen')
  await open('/settings/backup')
  await expect(page.getByTestId('backup-replica')).toContainText('5 minuten geleden')
  await expect(page.getByLabel('Koppelcode')).toHaveCount(0)
})

test('an ordinary org: no banner; an admin of the installation makes a link code, shown once', async ({ page, console: open }) => {
  const backup = await fakeBackup(page, { role: 'none', protocol: 1, schema: 'abcd1234' })
  await open('/settings/backup')
  await expect(page.getByTestId('backup-banner')).toHaveCount(0)
  await page.getByRole('button', { name: 'Koppelcode maken' }).click()
  await expect(page.getByTestId('backup-invite-code')).toHaveText(/^arcanum-backup:/)
  await expect(page.getByText('Je ziet ze maar één keer')).toBeVisible()
  expect(backup.invites).toBe(1)
})

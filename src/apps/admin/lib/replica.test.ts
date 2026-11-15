import { describe, expect, it } from 'vitest'
import { editableOnReplica } from './replica'

describe('editableOnReplica', () => {
  it('keeps the reports, the own profile, export and the way out open on a backup', () => {
    for (const p of ['/reports', '/settings/profile', '/settings/data', '/settings/backup', '/console/reports', '/console/settings/backup']) expect(editableOnReplica(p), p).toBe(true)
  })

  it('closes every page that changes the org', () => {
    for (const p of ['/', '/dashboard', '/users', '/products', '/catalogs', '/catalogs/abc', '/events', '/tables', '/staff', '/registers', '/devices', '/settings/appearance', '/settings/preferences', '/settings/payment-providers', '/console/products', '/reportsx']) expect(editableOnReplica(p), p).toBe(false)
  })
})

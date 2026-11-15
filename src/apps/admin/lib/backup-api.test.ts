import { describe, expect, it } from 'vitest'
import { agoParts, errorKind } from './backup-api'

describe('the backup status words', () => {
  it('tells an unreachable cloud from the cloud refusing', () => {
    expect(errorKind('unreachable: connect ETIMEDOUT')).toBe('unreachable')
    expect(errorKind('sync_cloud_daily_limit')).toBe('sync_cloud_daily_limit')
    expect(errorKind('502: Unexpected worker error')).toBe('502')
    // The backup is gone on the cloud: now its own code, before 0.1.96 a bare 401.
    expect(errorKind('sync_key_refused')).toBe('sync_key_refused')
    expect(errorKind('401: Unauthorized')).toBe('sync_key_refused')
  })

  it('says how long ago in the largest whole unit', () => {
    const now = Date.parse('2026-11-15T12:00:00Z')
    expect(agoParts('2026-11-15T11:59:40Z', now)).toEqual(['now', 0])
    expect(agoParts('2026-11-15T11:55:00Z', now)).toEqual(['minutes', 5])
    expect(agoParts('2026-11-15T09:00:00Z', now)).toEqual(['hours', 3])
    expect(agoParts('2026-11-12T12:00:00Z', now)).toEqual(['days', 3])
  })
})

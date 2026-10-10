import { describe, expect, it } from 'vitest'
import { formatEuro } from './format'
import { formatEuro as adminFormatEuro } from '@/apps/admin/lib/format'

describe('formatEuro', () => {
  it('euro and cents, Belgian style; a discount (negative) as "-€ …"', () => {
    for (const f of [formatEuro, adminFormatEuro]) {
      expect(f(250)).toBe('€ 2,50')
      expect(f(0)).toBe('€ 0,00')
      expect(f(-150)).toBe('-€ 1,50')
      expect(f(-5)).toBe('-€ 0,05')
    }
  })
})

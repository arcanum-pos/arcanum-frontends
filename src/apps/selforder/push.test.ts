import { describe, expect, it } from 'vitest'
import { isIos } from './push'

describe('isIos', () => {
  it('an iPhone, and an iPad that says it is a Mac (it has a touch screen)', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X)', 5)).toBe(true)
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 5)).toBe(true)
  })
  it('a Mac, an Android phone', () => {
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 0)).toBe(false)
    expect(isIos('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 5)).toBe(false)
  })
})

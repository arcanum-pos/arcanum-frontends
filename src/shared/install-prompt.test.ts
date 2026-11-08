import { describe, expect, it } from 'vitest'
import { browserFor } from './install'

// The menu "Installeer als app" explains when the browser doesn't offer itself.
describe('browserFor: whose install menu to explain', () => {
  it('Edge, Chrome, Android; Edge or Chrome on Android: the Android menu', () => {
    expect(browserFor('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0')).toBe('edge')
    expect(browserFor('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36')).toBe('chrome')
    expect(browserFor('Mozilla/5.0 (Linux; Android 14; SM-X110) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36')).toBe('android')
    expect(browserFor('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36 EdgA/142.0.0.0')).toBe('android')
  })

  it('none where there is no install to explain', () => {
    expect(browserFor('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0')).toBeNull()
    expect(browserFor('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 OPR/120.0.0.0')).toBeNull()
  })
})

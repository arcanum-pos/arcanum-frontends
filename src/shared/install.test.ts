import { describe, expect, it } from 'vitest'
import { appStorage } from './install'

const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15'

describe('appStorage: where an installed app gets its own storage', () => {
  it('every browser on an iPhone or iPad (an iPad says it is a Mac)', () => {
    expect(appStorage('Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1', 5)).toBe('ios')
    expect(appStorage('Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1', 5)).toBe('ios')
    expect(appStorage(MAC_SAFARI, 5)).toBe('ios')
  })
  it('Safari 17+ on a Mac (Add to Dock)', () => {
    expect(appStorage(MAC_SAFARI, 0)).toBe('mac')
    expect(appStorage(MAC_SAFARI.replace('Version/18.6', 'Version/16.6'), 0)).toBe('shared')
  })
  it('Chrome, Edge, Firefox on a Mac; Android; Windows: shared with the browser', () => {
    expect(appStorage('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', 0)).toBe('shared')
    expect(appStorage('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0', 0)).toBe('shared')
    expect(appStorage('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:144.0) Gecko/20100101 Firefox/144.0', 0)).toBe('shared')
    expect(appStorage('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36', 5)).toBe('shared')
    expect(appStorage('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', 0)).toBe('shared')
  })
})

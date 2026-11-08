import { describe, expect, it } from 'vitest'
import { appStorage, orgManifestUrl, startPageFor } from './install'

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

describe("startPageFor: the page an installed screen opens (its manifest's start_url)", () => {
  it('the screen and the view it shows', () => {
    expect(startPageFor('kassa')).toBe('/kassa.html')
    expect(startPageFor('display')).toBe('/display.html')
    expect(startPageFor('station')).toBe('/station.html')
    expect(startPageFor('station-st_1')).toBe('/station.html')
    expect(startPageFor('pickup')).toBe('/station.html?view=pickup')
    expect(startPageFor('entrance')).toBe('/waiter.html?view=ingang')
    expect(startPageFor('waiter')).toBe('/waiter.html')
    expect(startPageFor('tap')).toBe('/tap')
    expect(startPageFor('console')).toBe('/console')
  })

  it("none it doesn't know (a self-order page has its own manifest)", () => {
    expect(startPageFor('selforder')).toBeNull()
    expect(orgManifestUrl('org-1', 'selforder', 'Bestellen')).toBe('/icons/org/org-1/selforder.webmanifest?name=Bestellen')
  })

  it("the org's manifest link carries it", () => {
    expect(orgManifestUrl('org-1', 'kassa')).toBe('/icons/org/org-1/kassa.webmanifest?start=%2Fkassa.html')
    expect(orgManifestUrl('org 1', 'pickup', 'Afhalen')).toBe('/icons/org/org%201/pickup.webmanifest?name=Afhalen&start=%2Fstation.html%3Fview%3Dpickup')
  })
})

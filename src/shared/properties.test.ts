// Property-based tests (fast-check) for what the screens read from outside:
// socket messages, the kassa's order on the customer display, branding and
// /version answers, pairing links and codes as typed - and the money shown.
import fc from 'fast-check'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatEuro as adminFormatEuro } from '@/apps/admin/lib/format'
import { readBranding, textOn } from './branding'
import { customerBill, mergeCustomerLines, readCustomerOrder } from './customer-order'
import { formatEuro } from './format'
import { ICON_FOR_ROLE, isRole } from './install'
import { pickRelease, pickVersionInfo } from './source-url'
import { handlerFor, normalizeCode, type NotificationHandlers } from './terminal'

const PROTOTYPE_NAMES = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf']
const key = fc.oneof(fc.string(), fc.constantFrom(...PROTOTYPE_NAMES))

describe('formatEuro', () => {
  it('"€ 2,50" style for any amount, and reads back to the same cents', () => {
    for (const format of [formatEuro, adminFormatEuro]) {
      fc.assert(
        fc.property(fc.integer({ min: -1e12, max: 1e12 }), (cents) => {
          const text = format(cents)
          expect(text).toMatch(/^-?€ \d+,\d{2}$/)
          const back = Math.round(Number(text.replace('€ ', '').replace(',', '.')) * 100)
          expect(back).toBe(cents || 0)
        }),
      )
    }
  })
})

describe('socket messages', () => {
  it('handlerFor: only one of the handlers given, never an inherited name', () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.string(), { maxLength: 5 }), fc.oneof(key, fc.anything()), (names, event) => {
        const handlers: NotificationHandlers = Object.fromEntries(names.map((n) => [n, () => {}]))
        const handler = handlerFor(handlers, event)
        if (typeof event === 'string' && names.includes(event)) expect(handler).toBe(handlers[event])
        else expect(handler).toBeUndefined()
      }),
    )
  })
})

describe('pairing', () => {
  it('normalizeCode: however the code is typed, the same code; idempotent', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Z0-9]{8}$/), fc.constantFrom('', ' ', '-', ' - '), fc.boolean(), (code, sep, lower) => {
        const typed = `${code.slice(0, 4)}${sep}${code.slice(4)}`
        expect(normalizeCode(lower ? typed.toLowerCase() : typed)).toBe(code)
      }),
    )
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(normalizeCode(normalizeCode(s))).toBe(normalizeCode(s))
      }),
    )
  })

  it("isRole: a pairing link's role is one of the four, nothing else", () => {
    fc.assert(
      fc.property(fc.oneof(key, fc.constantFrom('pos', 'cfd', 'station', 'tap'), fc.constant(null)), (role) => {
        expect(isRole(role)).toBe(role !== null && Object.keys(ICON_FOR_ROLE).includes(role))
      }),
    )
  })
})

describe('what the server says', () => {
  it('pickVersionInfo: anything in, an http(s) source address and a sane release out', () => {
    fc.assert(
      fc.property(fc.oneof(fc.anything(), fc.record({ source_url: fc.oneof(fc.webUrl(), fc.string()), release: fc.oneof(fc.string(), fc.anything()), installer: fc.anything() })), (body) => {
        const info = pickVersionInfo(body)
        expect(info.sourceUrl).toMatch(/^https?:\/\//)
        expect(typeof info.installer).toBe('boolean')
        const release = pickRelease(body)
        if (typeof release === 'string') expect(release).toMatch(/^[0-9A-Za-z.+-]{1,40}$/)
      }),
    )
  })

  it("readBranding: colours as #rrggbb or none, a logo only from this installation's route", () => {
    const color = fc.oneof(fc.string(), fc.stringMatching(/^#[0-9a-fA-F]{6}$/), fc.anything())
    fc.assert(
      fc.property(fc.oneof(fc.anything(), fc.record({ primary: color, accent: color, logoUrl: fc.oneof(fc.webUrl(), fc.string(), fc.constant('/api/public/branding/o/logo.png?v=1')) })), (value) => {
        const b = readBranding(value)
        for (const c of [b.primary, b.accent]) if (c !== null) expect(c).toMatch(/^#[0-9a-f]{6}$/)
        if (b.logoUrl !== null) expect(b.logoUrl).toMatch(/^\/api\/public\/branding\/[^/?#]+\/logo\.png/)
      }),
    )
  })

  it('textOn: the better-reading of black and white on any colour', () => {
    const lum = (hex: string) => {
      const ch = (i: number) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * ch(1) + 0.7152 * ch(3) + 0.0722 * ch(5)
    }
    const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
    fc.assert(
      fc.property(fc.stringMatching(/^#[0-9a-f]{6}$/), (bg) => {
        const text = textOn(bg)
        const other = text === '#ffffff' ? '#0a0a0a' : '#ffffff'
        expect(['#ffffff', '#0a0a0a']).toContain(text)
        expect(contrast(text, bg)).toBeGreaterThanOrEqual(contrast(other, bg) - 1e-9)
        // Whichever wins always reads (WCAG AA for large text).
        expect(contrast(text, bg)).toBeGreaterThanOrEqual(3)
      }),
    )
  })
})

describe("the kassa's order on the customer display", () => {
  beforeEach(() => vi.stubGlobal('window', { location: { origin: 'https://arcanum.test' } }))
  afterEach(() => vi.unstubAllGlobals())

  const line = fc.record({ name: fc.string({ maxLength: 8 }), quantity: fc.integer({ min: -2, max: 20 }), unitPriceCents: fc.integer({ min: -500, max: 5000 }), category: fc.option(fc.string(), { nil: null }) })

  it('readCustomerOrder: anything in, only well-formed lines and a follow link on this site out', () => {
    const order = fc.record({ label: fc.anything(), lines: fc.array(fc.oneof(line, fc.anything())), paidCents: fc.anything(), eventId: fc.anything(), followUrl: fc.oneof(fc.webUrl(), fc.string(), fc.constant('/volg/abc')) }, { requiredKeys: ['lines'] })
    fc.assert(
      fc.property(fc.oneof(fc.anything(), order), (value) => {
        const o = readCustomerOrder(value)
        if (!o) return
        for (const l of o.lines) expect(typeof l.name === 'string' && Number.isInteger(l.quantity) && Number.isInteger(l.unitPriceCents)).toBe(true)
        if (o.followUrl !== null) expect(o.followUrl).toMatch(/^https:\/\/arcanum\.test\/volg\/[A-Za-z0-9_-]+$/)
        if (o.eventId !== null) expect(o.eventId).toMatch(/^[A-Za-z0-9_-]{1,64}$/)
      }),
    )
  })

  it('mergeCustomerLines keeps every item and its price; customerBill never shows a negative open amount', () => {
    const total = (ls: { quantity: number; unitPriceCents: number }[]) => ls.filter((l) => l.quantity > 0).reduce((s, l) => s + l.quantity * l.unitPriceCents, 0)
    fc.assert(
      fc.property(fc.array(line, { maxLength: 12 }), fc.integer({ min: 0, max: 100_000 }), fc.integer({ min: 0, max: 1000 }), (lines, amount, tip) => {
        const merged = mergeCustomerLines(lines)
        expect(total(merged)).toBe(total(lines))
        expect(new Set(merged.map((l) => `${l.name}|${l.unitPriceCents}`)).size).toBe(merged.length)
        const bill = customerBill({ label: '', number: null, eventName: null, eventId: null, paidCents: null, paying: null, lines, followUrl: null }, amount, tip)
        expect(bill.itemsCents).toBe(total(lines))
        expect(bill.openCents).toBeGreaterThanOrEqual(0)
        expect(bill.alreadyPaidCents).toBeGreaterThanOrEqual(0)
      }),
    )
  })
})

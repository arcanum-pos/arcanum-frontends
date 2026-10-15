import { describe, expect, it } from 'vitest'
import { nextStatus, previousStatus, visibleTickets, type Ticket } from './lib'

const ticket = (id: string, status: Ticket['status'], paid: boolean): Ticket => ({ id, tabId: id, status, createdAt: '', updatedAt: '', number: 1, label: '', paid, selfOrder: false, lines: [] })

describe('station screen', () => {
  it('moves ordered → in progress → ready → delivered, and back', () => {
    expect([nextStatus('ordered'), nextStatus('in_progress'), nextStatus('ready'), nextStatus('delivered')]).toEqual(['in_progress', 'ready', 'delivered', null])
    expect([previousStatus('ordered'), previousStatus('delivered')]).toEqual([null, 'ready'])
  })

  it('only paid by default (saying how many are hidden); delivered only when asked', () => {
    const list = [ticket('a', 'ordered', true), ticket('b', 'ordered', false), ticket('c', 'delivered', true), ticket('d', 'delivered', false)]
    expect(visibleTickets(list, { onlyPaid: true, showDelivered: false })).toEqual({ shown: [list[0]], hiddenUnpaid: 1 })
    expect(visibleTickets(list, { onlyPaid: false, showDelivered: false }).shown.map((t) => t.id)).toEqual(['a', 'b'])
    expect(visibleTickets(list, { onlyPaid: false, showDelivered: true }).shown.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd'])
    // On a tab paid when leaving: shown even with "only paid".
    const onTab = { ...ticket('e', 'ordered', false), payLater: true }
    expect(visibleTickets([...list, onTab], { onlyPaid: true, showDelivered: false })).toEqual({ shown: [list[0], onTab], hiddenUnpaid: 1 })
  })
})

describe('pickup screen', () => {
  it('three columns by number; a ready order only while fresh', async () => {
    const { pickupColumns } = await import('./lib')
    const now = Date.parse('2026-10-15T12:00:00Z')
    const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString()
    const columns = pickupColumns(
      [
        { number: 12, status: 'ordered', updatedAt: at(1) },
        { number: 9, status: 'ordered', updatedAt: at(2) },
        { number: 7, status: 'in_progress', updatedAt: at(3) },
        { number: 5, status: 'ready', updatedAt: at(2), mode: 'Take away' },
        { number: 3, status: 'ready', updatedAt: at(16) },
      ],
      now
    )
    expect(columns.received.map((o) => o.number)).toEqual([9, 12])
    expect(columns.preparing.map((o) => o.number)).toEqual([7])
    expect(columns.ready.map((o) => o.number)).toEqual([5])
  })
})

describe('only my tickets', () => {
  it("hides what colleagues are making; new ones nobody took stay", async () => {
    const { visibleTickets } = await import('./lib')
    const base = { tabId: 't', createdAt: '', updatedAt: '', number: 1, label: '', paid: true, selfOrder: false, lines: [] }
    const list = [
      { ...base, id: 'new', status: 'ordered' as const, claimedBy: null },
      { ...base, id: 'mine', status: 'in_progress' as const, claimedBy: { id: 'an', name: 'An', at: null } },
      { ...base, id: 'jans', status: 'in_progress' as const, claimedBy: { id: 'jan', name: 'Jan', at: null } },
    ]
    expect(visibleTickets(list, { onlyPaid: true, showDelivered: false, mine: 'an' }).shown.map((t) => t.id)).toEqual(['new', 'mine'])
    expect(visibleTickets(list, { onlyPaid: true, showDelivered: false, mine: null }).shown.map((t) => t.id)).toEqual(['new', 'mine', 'jans'])
  })
})

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

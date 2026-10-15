// The entrance screen as a paired device (release D): a station screen with
// view 'tables' — the promised tables, waiting then ready, live over the
// device's own socket; no station, no tickets.
import { test, expect, type WebSocketRoute } from '@playwright/test'
import { guardCsp } from './csp-guard'

test('a paired entrance screen: the promised tables, live', async ({ page, context }) => {
  const violations = guardCsp(context)
  let promised = [
    { name: '5', zone: null, ready: false, promisedAt: '' },
    { name: 'T2', zone: 'Terras', ready: false, promisedAt: '' },
  ]
  const calls: string[] = []
  const sockets: WebSocketRoute[] = []
  await page.routeWebSocket(/\/devices\/connect/, (ws) => {
    sockets.push(ws)
  })
  await page.addInitScript(() => localStorage.setItem('arcanum-terminal', JSON.stringify({ terminalId: 'st-9', role: 'station', orgId: 'org-1', orgName: 'Scouts', name: 'Ingang' })))
  await page.route(/\/api\//, (route) => {
    const p = new URL(route.request().url()).pathname
    calls.push(p)
    if (p === '/api/devices/ws-token') return route.fulfill({ json: { token: 'tok' } })
    if (p === '/api/organizations/org-1/devices/st-9') return route.fulfill({ json: { terminal_id: 'st-9', role: 'station', station_id: '', station_name: null, view: 'tables' } })
    if (p === '/api/organizations/org-1/promised-tables') return route.fulfill({ json: promised })
    return route.fulfill({ status: 404, json: {} })
  })
  await page.goto('/station.html')
  await expect(page.getByTestId('promised')).toHaveCount(2)
  await expect(page.getByTestId('promised').first()).toContainText('even geduld')
  promised = [{ ...promised[0], ready: true }, promised[1]]
  await expect.poll(() => sockets.length).toBeGreaterThan(0)
  sockets.forEach((ws) => ws.send(JSON.stringify({ event: 'tables_changed' })))
  await expect(page.getByTestId('promised').first()).toHaveAttribute('data-ready', 'true')
  // Never a station's tickets.
  expect(calls.some((c) => c.includes('/stations/'))).toBe(false)
  expect(violations()).toEqual([])
})

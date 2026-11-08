import type { Onboarding } from './api'

// "Aan de slag" (components/getting-started.tsx): shown on the dashboard
// until the organisation has a menukaart and a kassa - the kassalade is
// offered but optional (not every club takes cash) - or until it's hidden.
// What counts as done comes from what exists (GET …/onboarding), so it
// also works for organisations from before.
export function gettingStartedOpen(status: Onboarding | null, closed: boolean): boolean {
  return !!status && !closed && !(status.menu && status.kassa)
}

// Hidden per organisation, in this browser (README: localStorage keys).
const CLOSED_KEY = 'arcanum-admin-getting-started-closed'

function closedIds(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(CLOSED_KEY) ?? '[]')
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function isGettingStartedClosed(orgId: string): boolean {
  return closedIds().includes(orgId)
}

export function closeGettingStarted(orgId: string): void {
  try {
    localStorage.setItem(CLOSED_KEY, JSON.stringify([...new Set([...closedIds(), orgId])].slice(-20)))
  } catch {
    // Private mode: it shows again next time.
  }
}

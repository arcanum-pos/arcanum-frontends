import type { Onboarding } from './api'

// "Aan de slag" (components/getting-started.tsx): shown on the dashboard
// until all three are done - a menukaart, a kassa and a kassalade - or
// until it's hidden with its X. The kassalade is optional (not every club
// takes cash): its step can be skipped ("Niet nodig"). What counts as done
// comes from what exists (GET …/onboarding), so it also works for
// organisations from before.
export function gettingStartedOpen(status: Onboarding | null, closed: boolean, registerSkipped = false): boolean {
  return !!status && !closed && !(status.menu && status.kassa && (status.register || registerSkipped))
}

// Hidden per organisation, in this browser (README: localStorage keys);
// likewise the kassalade step skipped.
const CLOSED_KEY = 'arcanum-admin-getting-started-closed'
const NO_REGISTER_KEY = 'arcanum-admin-getting-started-no-register'

function orgIds(key: string): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function addOrgId(key: string, orgId: string): void {
  try {
    localStorage.setItem(key, JSON.stringify([...new Set([...orgIds(key), orgId])].slice(-20)))
  } catch {
    // Private mode: it shows again next time.
  }
}

export const isGettingStartedClosed = (orgId: string): boolean => orgIds(CLOSED_KEY).includes(orgId)
export const closeGettingStarted = (orgId: string): void => addOrgId(CLOSED_KEY, orgId)
export const isRegisterSkipped = (orgId: string): boolean => orgIds(NO_REGISTER_KEY).includes(orgId)
export const skipRegister = (orgId: string): void => addOrgId(NO_REGISTER_KEY, orgId)

import { useEffect, useSyncExternalStore } from 'react'

// A screen guests look at (the pickup screen, the entrance screen) shows no
// ? while it's up: they're not Arcanum's users, and a report would show the
// organization's screen to Kaboutersoft. Such a screen calls
// useGuestFacing(); the ? button (support-button.tsx) watches.
let count = 0
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

export function useGuestFacing() {
  useEffect(() => {
    count++
    notify()
    return () => {
      count--
      notify()
    }
  }, [])
}

export function useIsGuestFacing(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => count > 0,
  )
}

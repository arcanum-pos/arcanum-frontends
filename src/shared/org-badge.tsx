import { useEffect, useState } from 'react'
import { getStoredTerminalInfo } from './terminal'

// Fixed top-right badge showing which organization this browser/device is
// registered under. Useful mainly when testing many devices at once in
// separate (private) browser windows, where otherwise there's no way to
// tell at a glance which org a given window/tab belongs to. Renders nothing
// if this browser never registered a device (or registered before
// org-scoping existed and has no orgName stored).
export function OrgBadge() {
  const [orgName, setOrgName] = useState<string | null>(null)

  useEffect(() => {
    const terminal = getStoredTerminalInfo()
    if (terminal?.orgName) setOrgName(terminal.orgName)
  }, [])

  if (!orgName) return null

  return (
    <span className="pointer-events-none fixed top-2 right-2 z-40 max-w-[calc(100vw-1rem)] truncate rounded-full bg-foreground px-2.5 py-1 text-xs font-semibold text-background opacity-85">
      {orgName}
    </span>
  )
}

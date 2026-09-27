import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { KioskShell } from '@/shared/kiosk-shell'
import { useMessages } from '@/shared/i18n'
import { ChoiceCard } from './ChoiceCard'
import { listMyMemberships, type Membership } from './lib'
import { CHOOSER_MESSAGES } from './messages'
import { getStoredTerminalInfo, PAGE_FOR_ROLE, registerNewTerminal, type Role } from '@/shared/terminal'

const ROLES: Role[] = ['pos', 'cfd', 'sim']

type View = { step: 'loading' } | { step: 'org-picker'; memberships: Membership[] } | { step: 'role-picker'; orgId: string; orgName: string }

// The language picked here stays this device's language — the customer
// display's too (see src/shared/i18n).
export default function App() {
  const m = useMessages(CHOOSER_MESSAGES)
  const [view, setView] = useState<View>({ step: 'loading' })
  const [registering, setRegistering] = useState(false)

  useEffect(() => {
    // Already registered on this browser — skip straight to the matching
    // page instead of asking again.
    const stored = getStoredTerminalInfo()
    if (stored) {
      window.location.replace(PAGE_FOR_ROLE[stored.role])
      return
    }

    listMyMemberships()
      .then((memberships) => {
        if (memberships.length === 0) {
          // No organization yet — send them to the admin portal to create
          // one; they'll come back here afterwards.
          window.location.replace('/console')
          return
        }
        if (memberships.length === 1) {
          setView({ step: 'role-picker', orgId: memberships[0].orgId, orgName: memberships[0].orgName })
          return
        }
        setView({ step: 'org-picker', memberships })
      })
      .catch((err) => console.error('Kon organisaties niet laden', err))
  }, [])

  async function chooseRole(role: Role, orgId: string, orgName: string) {
    setRegistering(true)
    await registerNewTerminal(role, orgId, orgName)
    window.location.href = PAGE_FOR_ROLE[role]
  }

  if (view.step === 'loading') {
    return (
      <KioskShell languagePicker>
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-24 w-full" />
        </div>
      </KioskShell>
    )
  }

  if (view.step === 'org-picker') {
    return (
      <KioskShell languagePicker>
        <div className="flex flex-col gap-4 text-center">
          <h1 className="font-heading text-xl font-bold">{m.whichOrg}</h1>
          <div className="flex flex-col gap-2">
            {view.memberships.map((m) => (
              <ChoiceCard key={m.orgId} title={m.orgName} onClick={() => setView({ step: 'role-picker', orgId: m.orgId, orgName: m.orgName })} />
            ))}
          </div>
        </div>
      </KioskShell>
    )
  }

  return (
    <KioskShell languagePicker>
      <div className="flex flex-col gap-4 text-center">
        <div>
          <h1 className="font-heading text-xl font-bold">{m.whichRole}</h1>
          <p className="text-sm text-muted-foreground">{m.org(view.orgName)}</p>
        </div>
        <div className="flex flex-col gap-2">
          {ROLES.map((role) => (
            <ChoiceCard
              key={role}
              title={m.roles[role].title}
              hint={m.roles[role].hint}
              onClick={() => !registering && chooseRole(role, view.orgId, view.orgName)}
            />
          ))}
        </div>
      </div>
    </KioskShell>
  )
}

import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { KioskShell } from '@/shared/kiosk-shell'
import { ChoiceCard } from './ChoiceCard'
import { getStoredTerminalInfo, listMyMemberships, PAGE_FOR_ROLE, registerNewTerminal, type Membership, type Role } from './lib'

const ROLE_OPTIONS: { role: Role; title: string; hint: string }[] = [
  { role: 'pos', title: 'Kassa', hint: 'Bonnen verkopen en betalingen aanmaken' },
  { role: 'cfd', title: 'Klantscherm', hint: 'Toont QR-codes en betaalstatus aan de klant' },
  { role: 'sim', title: 'SumUp-simulator', hint: 'Voor test zonder echte SumUp-reader' },
]

type View = { step: 'loading' } | { step: 'org-picker'; memberships: Membership[] } | { step: 'role-picker'; orgId: string; orgName: string }

export default function App() {
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
      <KioskShell>
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-24 w-full" />
        </div>
      </KioskShell>
    )
  }

  if (view.step === 'org-picker') {
    return (
      <KioskShell>
        <div className="flex flex-col gap-4 text-center">
          <h1 className="font-heading text-xl font-bold">Voor welke organisatie is dit toestel?</h1>
          <div className="flex flex-col gap-2">
            {view.memberships.map((m) => (
              <ChoiceCard key={m.orgId} title={m.orgName} onClick={() => setView({ step: 'role-picker', orgId: m.orgId, orgName: m.orgName })} />
            ))}
          </div>
          <a href="/console" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Naar het beheerportaal
          </a>
        </div>
      </KioskShell>
    )
  }

  return (
    <KioskShell>
      <div className="flex flex-col gap-4 text-center">
        <div>
          <h1 className="font-heading text-xl font-bold">Wat is dit toestel?</h1>
          <p className="text-sm text-muted-foreground">Organisatie: {view.orgName}</p>
        </div>
        <div className="flex flex-col gap-2">
          {ROLE_OPTIONS.map((opt) => (
            <ChoiceCard
              key={opt.role}
              title={opt.title}
              hint={opt.hint}
              onClick={() => !registering && chooseRole(opt.role, view.orgId, view.orgName)}
            />
          ))}
        </div>
        <a href="/console" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Naar het beheerportaal
        </a>
      </div>
    </KioskShell>
  )
}

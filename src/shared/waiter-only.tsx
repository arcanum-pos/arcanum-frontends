import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useMessages, type Messages } from './i18n'
import { listMyMemberships } from './memberships'

// The role Bediening sees only the waiter screen (DOMAIN_MODEL.md "Tables
// and waiters", T6): the console and the kassa say so and point there.
const TEXTS: Messages<{ title: string; text: string; open: string }> = {
  nl: { title: 'Bediening', text: 'Met de rol Bediening werk je op het bedieningsscherm.', open: 'Open de bediening' },
  fr: { title: 'Service', text: 'Avec le rôle Service, vous travaillez sur l’écran de service.', open: 'Ouvrir le service' },
  en: { title: 'Waiter', text: 'With the role Waiter, you work on the waiter screen.', open: 'Open the waiter screen' },
}

// Whether the signed-in person is only Bediening in this organisation.
export function useWaiterOnly(orgId: string | null | undefined): boolean {
  const [waiterOnly, setWaiterOnly] = useState(false)
  useEffect(() => {
    if (!orgId) return
    listMyMemberships()
      .then((list) => setWaiterOnly(list.find((x) => x.orgId === orgId)?.role === 'waiter'))
      .catch(() => setWaiterOnly(false))
  }, [orgId])
  return waiterOnly
}

export function WaiterOnly() {
  const t = useMessages(TEXTS)
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 p-10 text-center" data-testid="waiter-only">
      <h1 className="text-xl font-semibold">{t.title}</h1>
      <p className="text-muted-foreground">{t.text}</p>
      <Button asChild>
        <a href="/bediening">{t.open}</a>
      </Button>
    </div>
  )
}

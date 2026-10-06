import { UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useMessages } from '@/shared/i18n'
import { whoami } from '../lib/api'
import { useAsync } from '../lib/use-async'
import { ADMIN_SHELL_MESSAGES } from '../messages/shell'

// Signed in, but a member of no organisation here, and not someone who may
// create one (lib/first-organization.ts): say so, instead of an empty
// console. Organisations come from an invite, a demo or the installer —
// not from whoever happens to sign in.
export function NoMembership() {
  const m = useMessages(ADMIN_SHELL_MESSAGES)
  const { data: me } = useAsync(() => whoami(), [])
  return (
    <div className="mx-auto mt-10 max-w-md" data-testid="no-membership">
      <Card>
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg border">
            <UserX className="size-5" aria-hidden="true" />
          </div>
          <CardTitle>{m.noMembershipTitle}</CardTitle>
          {me?.email && <CardDescription>{m.noMembershipText(me.email)}</CardDescription>}
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">{m.noMembershipInvite}</p>
          <Button variant="outline" onClick={() => window.location.assign('/logout')}>
            {m.noMembershipSignOut}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

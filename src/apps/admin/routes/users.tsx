import { useState } from 'react'
import { MoreHorizontal, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { inviteMember, listMembers, removeMember, whoami } from '../lib/api'
import { useAsync } from '../lib/use-async'
import { useOrg } from '../lib/org-context'

export default function UsersPage() {
  const { currentOrg } = useOrg()
  const orgId = currentOrg?.id ?? null
  const { data: members, loading, error, reload } = useAsync(
    () => (orgId ? listMembers(orgId) : Promise.resolve([])),
    [orgId]
  )
  // Used to hide the "Verwijderen" action on your own row (the backend
  // rejects it anyway — see worker's removeMember — this just avoids
  // showing an action that always fails). UI-only: matches on sub alone,
  // unlike the backend's issuer+sub check, since this is just a hint.
  const { data: who } = useAsync(() => whoami(), [])
  const currentUserSub = who?.sub ?? null

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'cashier'>('cashier')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  async function handleInvite() {
    if (!orgId) return
    const email = inviteEmail.trim().toLowerCase()
    if (!email) return
    setInviting(true)
    setInviteError(null)
    try {
      await inviteMember(orgId, email, inviteRole)
      setInviteEmail('')
      setInviteOpen(false)
      reload()
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : String(err))
    } finally {
      setInviting(false)
    }
  }

  async function handleRemove(membershipId: string, email: string) {
    if (!orgId) return
    if (!window.confirm(`${email} verwijderen uit deze organisatie?`)) return
    setRemovingId(membershipId)
    try {
      await removeMember(orgId, membershipId)
      reload()
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-muted-foreground">Leden van {currentOrg?.name ?? 'deze organisatie'} en hun rol.</p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button disabled={!orgId}>
              <UserPlus />
              Lid uitnodigen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Lid uitnodigen</DialogTitle>
              <DialogDescription>Ze krijgen deze rol zodra ze inloggen met dit e-mailadres.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="invite-email">E-mailadres</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-2">
                <Label>Rol</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'admin' | 'cashier')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cashier">Kassier (cashier)</SelectItem>
                    <SelectItem value="admin">Beheerder (admin)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
            </div>
            <DialogFooter>
              <Button onClick={handleInvite} disabled={inviting}>
                {inviting ? 'Bezig...' : 'Uitnodigen'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && <p className="text-sm text-destructive">Kon leden niet laden: {error}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>E-mail</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading &&
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={4}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ))}
          {!loading &&
            members?.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.invitedEmail}</TableCell>
                <TableCell>{member.role === 'admin' ? 'Beheerder' : 'Kassier'}</TableCell>
                <TableCell>
                  <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                    {member.status === 'active' ? 'Actief' : 'In afwachting'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {member.userSub && member.userSub === currentUserSub ? (
                    <span className="text-sm text-muted-foreground">(jij)</span>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8" disabled={removingId === member.id}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem variant="destructive" onClick={() => handleRemove(member.id, member.invitedEmail)}>
                          Verwijderen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  )
}

import { useState } from 'react'
import { Copy, MoreHorizontal, UserPlus } from 'lucide-react'
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
import { inviteMember, listMembers, removeMember, whoami, type Member } from '../lib/api'
import { inviteText, loginUrl } from '../lib/invite-text'
import { useAsync } from '../lib/use-async'
import { useOrg } from '../lib/org-context'
import { useMessages } from '@/shared/i18n'
import { ADMIN_ORG_MESSAGES } from '../messages/org'

export default function UsersPage() {
  const m = useMessages(ADMIN_ORG_MESSAGES)
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
  // The invitation to pass on yourself: right after an invite whose mail
  // wasn't sent (notSent), or for any pending member from the row menu.
  const [share, setShare] = useState<{ email: string; text: string; notSent: boolean } | null>(null)

  function openShare(member: Pick<Member, 'invitedEmail' | 'role'>, notSent: boolean, url = loginUrl()) {
    const text = inviteText({
      orgName: currentOrg?.name ?? '',
      role: member.role,
      email: member.invitedEmail,
      loginUrl: url,
      locale: currentOrg?.locale,
    })
    setShare({ email: member.invitedEmail, text, notSent })
  }

  async function handleInvite() {
    if (!orgId) return
    const email = inviteEmail.trim().toLowerCase()
    if (!email) return
    setInviting(true)
    setInviteError(null)
    try {
      const invited = await inviteMember(orgId, email, inviteRole)
      setInviteEmail('')
      setInviteOpen(false)
      reload()
      if (invited.mailSent === false) openShare(invited, true, invited.loginUrl || undefined)
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : String(err))
    } finally {
      setInviting(false)
    }
  }

  async function handleRemove(membershipId: string, email: string) {
    if (!orgId) return
    if (!window.confirm(m.users.confirmRemove(email))) return
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
          <h1 className="text-2xl font-semibold tracking-tight">{m.users.title}</h1>
          <p className="text-muted-foreground">{m.users.subtitle(currentOrg?.name ?? m.thisOrg)}</p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button disabled={!orgId}>
              <UserPlus />
              {m.users.invite}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{m.users.invite}</DialogTitle>
              <DialogDescription>{m.users.inviteHint}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="invite-email">{m.users.emailAddress}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-2">
                <Label>{m.users.role}</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'admin' | 'cashier')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cashier">{m.users.cashierOption}</SelectItem>
                    <SelectItem value="admin">{m.users.adminOption}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
            </div>
            <DialogFooter>
              <Button onClick={handleInvite} disabled={inviting}>
                {inviting ? m.busy : m.users.submit}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && <p className="text-sm text-destructive">{m.users.loadError(error)}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{m.users.email}</TableHead>
            <TableHead>{m.users.role}</TableHead>
            <TableHead>{m.status}</TableHead>
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
                <TableCell>{member.role === 'admin' ? m.users.admin : m.users.cashier}</TableCell>
                <TableCell>
                  <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                    {member.status === 'active' ? m.users.active : m.users.pending}
                  </Badge>
                </TableCell>
                <TableCell>
                  {member.userSub && member.userSub === currentUserSub ? (
                    <span className="text-sm text-muted-foreground">{m.users.you}</span>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8" disabled={removingId === member.id}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {member.status === 'pending' && (
                          <DropdownMenuItem onClick={() => openShare(member, false)}>
                            <Copy />
                            {m.users.copyInvite}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem variant="destructive" onClick={() => handleRemove(member.id, member.invitedEmail)}>
                          {m.remove}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>

      <ShareInviteDialog share={share} onClose={() => setShare(null)} />
    </div>
  )
}

function ShareInviteDialog({ share, onClose }: { share: { email: string; text: string; notSent: boolean } | null; onClose: () => void }) {
  const m = useMessages(ADMIN_ORG_MESSAGES)
  const [copied, setCopied] = useState(false)

  async function copy() {
    if (!share) return
    try {
      await navigator.clipboard.writeText(share.text)
      setCopied(true)
    } catch {
      // No clipboard (an insecure context, a refused permission): the text
      // stays selectable in the box.
    }
  }

  return (
    <Dialog
      open={share !== null}
      onOpenChange={(open) => {
        if (!open) {
          setCopied(false)
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.users.shareTitle}</DialogTitle>
          <DialogDescription>{share && (share.notSent ? m.users.shareNotSent(share.email) : m.users.shareHint(share.email))}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="invite-text">{m.users.shareText}</Label>
          <textarea
            id="invite-text"
            readOnly
            rows={7}
            value={share?.text ?? ''}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setCopied(false); onClose() }}>
            {m.users.close}
          </Button>
          <Button onClick={copy}>
            <Copy />
            {copied ? m.users.copied : m.users.copy}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

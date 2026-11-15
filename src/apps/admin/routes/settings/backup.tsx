import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { INTL_LOCALES, useLocale, useMessages } from '@/shared/i18n'
import { PromptDialog } from '../../components/prompt-dialog'
import { agoParts, createBackupInvite, errorKind, getBackupStatus, linkBackup, promoteBackup, unlinkBackup, type BackupStatus } from '../../lib/backup-api'
import { useOrg } from '../../lib/org-context'
import { ADMIN_BACKUP_MESSAGES } from '../../messages/backup'

const REFRESH_MS = 10_000

// Reservekopie (OFFLINE.md). On a local installation: link this org to a
// backup on a cloud installation, and how far it is. On the cloud: that
// this org is a backup, and making a link code for a new one.
export default function BackupPage() {
  const m = useMessages(ADMIN_BACKUP_MESSAGES)
  const { currentOrg, capabilities } = useOrg()
  const orgId = currentOrg?.id
  // With the org it belongs to: after switching orgs, nothing until its own answer.
  const [loaded, setLoaded] = useState<{ orgId: string; status: BackupStatus } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const status = loaded && loaded.orgId === orgId ? loaded.status : null
  const setStatus = useCallback((s: BackupStatus) => orgId && setLoaded({ orgId, status: s }), [orgId])

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    const load = () =>
      getBackupStatus(orgId)
        .then((s) => !cancelled && setLoaded({ orgId, status: s }))
        .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
    void load()
    const timer = setInterval(() => void load(), REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [orgId])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">{m.title}</h2>
        <p className="text-sm text-muted-foreground">{m.subtitle}</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {status?.role === 'none' && currentOrg && <LinkCard orgId={currentOrg.id} onLinked={setStatus} />}
      {status?.role === 'source' && currentOrg && <SourceCard orgId={currentOrg.id} status={status} onUnlinked={setStatus} />}
      {status?.role === 'replica' && currentOrg && <ReplicaCard orgId={currentOrg.id} orgName={currentOrg.name} status={status} onPromoted={setStatus} />}
      {capabilities?.canCreateOrganization && <InviteCard />}
    </div>
  )
}

function Ago({ iso }: { iso: string | null | undefined }) {
  const m = useMessages(ADMIN_BACKUP_MESSAGES)
  const { locale } = useLocale()
  if (!iso) return <>{m.never}</>
  const [unit, n] = agoParts(iso)
  const text = unit === 'now' ? m.ago.now : m.ago[unit](n)
  return <time dateTime={iso} title={new Date(iso).toLocaleString(INTL_LOCALES[locale])}>{text}</time>
}

function LinkCard({ orgId, onLinked }: { orgId: string; onLinked: (s: BackupStatus) => void }) {
  const m = useMessages(ADMIN_BACKUP_MESSAGES)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onLinked(await linkBackup(orgId, code))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.linkTitle}</CardTitle>
        <CardDescription>{m.linkText}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3" onSubmit={submit}>
          <Label htmlFor="backup-code">{m.codeLabel}</Label>
          <textarea
            id="backup-code"
            className="min-h-20 rounded-md border bg-transparent px-3 py-2 font-mono text-sm break-all"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={m.codePlaceholder}
            spellCheck={false}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div>
            <Button type="submit" disabled={busy || !code.trim()}>
              {busy ? m.busy : m.link}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function SourceCard({ orgId, status, onUnlinked }: { orgId: string; status: BackupStatus; onUnlinked: (s: BackupStatus) => void }) {
  const m = useMessages(ADMIN_BACKUP_MESSAGES)
  const [busy, setBusy] = useState(false)
  const kind = status.lastError ? errorKind(status.lastError) : null

  async function unlink() {
    if (!window.confirm(m.unlinkConfirm)) return
    setBusy(true)
    try {
      onUnlinked(await unlinkBackup(orgId))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card data-testid="backup-source">
      <CardHeader>
        <CardTitle>{m.linkTitle}</CardTitle>
        <CardDescription>{m.linkedTo(status.remoteUrl ?? '')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="text-muted-foreground">{m.lastSync}</dt>
          <dd>
            <Ago iso={status.lastSyncAt} />
          </dd>
          <dt className="text-muted-foreground">{m.pending}</dt>
          <dd>{status.pending ? status.pending : m.pendingNone}</dd>
          <dt className="text-muted-foreground">{m.firstSync}</dt>
          <dd>{status.firstSyncDoneAt ? m.firstSyncDone : m.firstSyncLeft(status.pendingFirstSync ?? 0)}</dd>
        </dl>
        {status.lastError && kind && (
          <p role="alert" className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
            <span className="font-medium">{m.lastError}: </span>
            {m.errors[kind] ?? status.lastError}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{m.versions(status.protocol, status.schema)}</p>
        <div>
          <Button variant="outline" onClick={unlink} disabled={busy}>
            {m.unlink}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ReplicaCard({ orgId, orgName, status, onPromoted }: { orgId: string; orgName: string; status: BackupStatus; onPromoted: (s: BackupStatus) => void }) {
  const m = useMessages(ADMIN_BACKUP_MESSAGES)
  const [promoting, setPromoting] = useState(false)
  return (
    <Card data-testid="backup-replica">
      <CardHeader>
        <CardTitle>{m.replicaTitle}</CardTitle>
        <CardDescription>{m.replicaText}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p>
          <span className="text-muted-foreground">{m.lastHeard}: </span>
          <Ago iso={status.lastSyncAt} />
        </p>
        <div>
          <Button variant="destructive" onClick={() => setPromoting(true)}>
            {m.promote}
          </Button>
        </div>
      </CardContent>
      {/* Disaster recovery (OFFLINE.md): deliberate, behind the org's name. */}
      {promoting && (
        <PromptDialog
          title={m.promoteTitle}
          description={m.promoteText(orgName)}
          label={m.promoteLabel}
          confirmLabel={m.promote}
          onConfirm={async (confirm) => {
            onPromoted(await promoteBackup(orgId, confirm))
            window.location.reload()
          }}
          onClose={() => setPromoting(false)}
        />
      )}
    </Card>
  )
}

// On a cloud installation: a link code for a local installation's org. The
// key in it is shown only now (the backend keeps its hash).
export function InviteCard() {
  const m = useMessages(ADMIN_BACKUP_MESSAGES)
  const { locale } = useLocale()
  const [invite, setInvite] = useState<{ code: string; expiresAt: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    setBusy(true)
    setError(null)
    try {
      setInvite(await createBackupInvite())
      setCopied(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    if (!invite) return
    try {
      await navigator.clipboard.writeText(invite.code)
      setCopied(true)
    } catch {
      // No clipboard (an insecure context): the code can still be selected.
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.inviteTitle}</CardTitle>
        <CardDescription>{m.inviteText}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {invite ? (
          <>
            <code className="rounded-md border bg-muted p-3 text-xs break-all select-all" data-testid="backup-invite-code">
              {invite.code}
            </code>
            <p className="text-sm text-muted-foreground">{m.inviteShownOnce(new Date(invite.expiresAt).toLocaleString(INTL_LOCALES[locale]))}</p>
            <div>
              <Button variant="outline" onClick={copy}>
                {copied ? m.copied : m.copy}
              </Button>
            </div>
          </>
        ) : (
          <div>
            <Button variant="outline" onClick={create} disabled={busy}>
              {busy ? m.busy : m.inviteCreate}
            </Button>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}

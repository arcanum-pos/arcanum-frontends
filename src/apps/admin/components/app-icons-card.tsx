import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useMessages } from '@/shared/i18n'
import { orgIconUrl } from '@/shared/install'
import { listMyMemberships } from '@/shared/memberships'
import { listOrgIcons, removeOrgIcon, setOrgIcon, type OrgIcon } from '../lib/api'
import { listStations, type Station } from '../lib/catalog-api'
import { iconSizes } from '../lib/icon-image'
import { useAsync } from '../lib/use-async'
import { ADMIN_SHELL_MESSAGES } from '../messages/shell'

// Weergave → App-iconen (2026-10-18): the organisation's own icon per page
// that can be installed as an app — what a phone, tablet or computer shows
// on its home screen, Dock or start menu, and in the tab. Per prep station
// too. Not set: the default (shown here as well). Admins change them;
// a device gets them when it's installed from its pairing link (or, in
// Chrome, Edge and Android, from the screen itself).
const PAGES = ['kassa', 'display', 'waiter', 'tap', 'selforder', 'station', 'pickup', 'entrance'] as const

export function AppIconsCard({ orgId }: { orgId: string }) {
  const m = useMessages(ADMIN_SHELL_MESSAGES).appIcons
  const { data: icons, reload } = useAsync(() => listOrgIcons(orgId).catch(() => [] as OrgIcon[]), [orgId])
  const { data: stations } = useAsync(() => listStations(orgId).catch(() => [] as Station[]), [orgId])
  const { data: admin } = useAsync(
    () => listMyMemberships().then((list) => list.some((ms) => ms.orgId === orgId && ms.role === 'admin')).catch(() => false),
    [orgId]
  )
  const own = new Map((icons ?? []).map((i) => [i.slot, i.updatedAt]))

  const rows: { slot: string; label: string; hint?: string }[] = []
  for (const page of PAGES) {
    rows.push({ slot: page, label: m.pages[page] })
    // Each prep station right after the station screens' own.
    if (page === 'station') for (const s of stations ?? []) rows.push({ slot: `station-${s.id}`, label: s.name, hint: m.prepStation })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.title}</CardTitle>
        <CardDescription>{m.hint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {rows.map((row) => (
          <IconRow key={row.slot} orgId={orgId} slot={row.slot} label={row.label} hint={row.hint} updatedAt={own.get(row.slot) ?? null} shown={own.get(row.slot) ?? (row.slot.startsWith('station-') ? own.get('station') : undefined) ?? 'standard'} admin={!!admin} onChanged={reload} />
        ))}
        {admin === false && <p className="pt-3 text-sm text-muted-foreground">{m.adminsOnly}</p>}
      </CardContent>
    </Card>
  )
}

// `shown`: which icon the preview is (a prep station without its own shows the station screens').
function IconRow({ orgId, slot, label, hint, updatedAt, shown, admin, onChanged }: { orgId: string; slot: string; label: string; hint?: string; updatedAt: string | null; shown: string; admin: boolean; onChanged: () => void }) {
  const m = useMessages(ADMIN_SHELL_MESSAGES).appIcons
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    setBusy(true)
    setError(null)
    try {
      await setOrgIcon(orgId, slot, await iconSizes(file))
      onChanged()
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : m.unreadable)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      await removeOrgIcon(orgId, slot)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 py-3" data-testid={`app-icon-${slot}`}>
      {/* A new address after each change: the browser shows the new one, not its copy. */}
      <img src={`${orgIconUrl(orgId, slot, 180)}?v=${encodeURIComponent(shown)}`} alt="" className="size-12 shrink-0 rounded-xl ring-1 ring-foreground/10" />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{label}</div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {hint && <span>{hint}</span>}
          <Badge variant={updatedAt ? 'default' : 'secondary'}>{updatedAt ? m.own : m.standard}</Badge>
        </div>
        {error && (
          <p className="mt-1 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
      {admin && (
        <div className="flex gap-2">
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            aria-label={m.uploadFor(label)}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void upload(file)
            }}
          />
          <Button variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            <Upload />
            {busy ? m.busy : m.upload}
          </Button>
          {updatedAt && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={remove}>
              {m.remove}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

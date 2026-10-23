import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { textOn } from '@/shared/branding'
import { useMessages } from '@/shared/i18n'
import { listMyMemberships } from '@/shared/memberships'
import { getBranding, removeBrandingLogo, setBrandingColors, setBrandingLogo, type OrgBranding } from '../lib/api'
import { logoPng } from '../lib/icon-image'
import { useAsync } from '../lib/use-async'
import { ADMIN_SHELL_MESSAGES } from '../messages/shell'
import { ColorField } from './color-field'

// Weergave → Klantscherm (2026-10-23): the customer display's logo and two
// colours — a main colour (the header and the total panel) and an accent
// (the stripe under the header, the quantities) — e.g. a scouts group's
// green and its scarf colour. An event can have colours of its own
// (Evenementen → Instellen). Only the customer display uses them; the
// kassa and this console keep their own look. Admins change them.
export function DisplayBrandingCard({ orgId }: { orgId: string }) {
  const m = useMessages(ADMIN_SHELL_MESSAGES).displayBranding
  const { data, reload } = useAsync(() => getBranding(orgId).catch(() => null), [orgId])
  const { data: admin } = useAsync(
    () => listMyMemberships().then((list) => list.some((ms) => ms.orgId === orgId && ms.role === 'admin')).catch(() => false),
    [orgId]
  )
  const [shown, setShown] = useState<OrgBranding | null>(null)
  const branding = shown ?? data ?? { primary: null, accent: null, logo: null }
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const logoUrl = branding.logo ? `/api/public/branding/${encodeURIComponent(orgId)}/logo.png?v=${encodeURIComponent(branding.logo.updatedAt)}` : null

  async function run(action: () => Promise<OrgBranding>, unreadable = false) {
    setBusy(true)
    setError(null)
    try {
      setShown(await action())
      reload()
    } catch (err) {
      setError(unreadable && !(err instanceof Error && err.message) ? m.unreadable : err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const locked = busy || !admin
  return (
    <Card data-testid="display-branding">
      <CardHeader>
        <CardTitle>{m.title}</CardTitle>
        <CardDescription>{m.hint}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="grid content-start gap-5">
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">{m.logo}</span>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-16 w-32 shrink-0 items-center justify-center rounded-lg border bg-muted/40 p-1.5">
                {logoUrl ? <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" data-testid="branding-logo" /> : <span className="text-xs text-muted-foreground">{m.noLogo}</span>}
              </div>
              {admin && (
                <>
                  <input
                    ref={input}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    aria-label={m.logo}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (file) void run(async () => setBrandingLogo(orgId, await logoPng(file)), true)
                    }}
                  />
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
                    <Upload />
                    {busy ? m.busy : logoUrl ? m.replace : m.upload}
                  </Button>
                  {logoUrl && (
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => removeBrandingLogo(orgId))}>
                      {m.remove}
                    </Button>
                  )}
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{m.logoHint}</p>
          </div>
          <ColorField id="primary" label={m.primary} value={branding.primary} emptyLabel={m.noColor} clearLabel={m.clear} disabled={locked} onChange={(primary) => run(() => setBrandingColors(orgId, { primary }))} />
          <ColorField id="accent" label={m.accent} value={branding.accent} emptyLabel={m.noColor} clearLabel={m.clear} disabled={locked} onChange={(accent) => run(() => setBrandingColors(orgId, { accent }))} />
          <p className="text-xs text-muted-foreground">{m.perEvent}</p>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {admin === false && <p className="text-sm text-muted-foreground">{m.adminsOnly}</p>}
        </div>
        <BrandingPreview primary={branding.primary} accent={branding.accent} logoUrl={logoUrl} />
      </CardContent>
    </Card>
  )
}

// The customer display in small, with these colours (the same rules as the display itself).
export function BrandingPreview({ primary, accent, logoUrl }: { primary: string | null; accent: string | null; logoUrl: string | null }) {
  const m = useMessages(ADMIN_SHELL_MESSAGES).displayBranding
  const branded = !!(primary || accent || logoUrl)
  const main = primary ?? '#0a0a0a'
  const acc = accent ?? primary ?? '#0a0a0a'
  return (
    <figure className="grid content-start gap-1.5 self-start" data-testid="branding-preview">
      <figcaption className="text-xs font-medium text-muted-foreground">{m.preview}</figcaption>
      <div className="overflow-hidden rounded-lg border bg-white text-neutral-950 shadow-sm">
        {branded && (
          <>
            <div className={cn('flex h-10 items-center gap-2 px-3', !primary && 'border-b')} style={primary ? { background: main, color: textOn(main) } : undefined}>
              {logoUrl && <img src={logoUrl} alt="" className="max-h-7 max-w-[40%] object-contain" />}
              <span className="truncate text-[13px] font-semibold">{m.previewEvent}</span>
            </div>
            {accent && <div className="h-1" style={{ background: acc }} />}
          </>
        )}
        <div className="flex h-32">
          <div className="flex min-w-0 flex-[1.25] flex-col gap-1.5 p-3">
            {[m.previewLine1, m.previewLine2].map((name, i) => (
              <div key={name} className="flex items-center gap-1.5 text-[11px]">
                <span className="rounded px-1 font-mono font-semibold" style={branded ? { background: acc, color: textOn(acc) } : { background: '#f4f4f5' }}>
                  {i + 1}
                </span>
                <span className="truncate">{name}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-[1] flex-col justify-start gap-0.5 p-3" style={{ background: primary ? main : '#0a0a0a', color: primary ? textOn(main) : '#fafafa' }}>
            <span className="text-[9px] font-semibold tracking-wider uppercase opacity-70">{m.previewTotal}</span>
            <span className="font-mono text-lg font-semibold">€ 14,50</span>
          </div>
        </div>
      </div>
    </figure>
  )
}

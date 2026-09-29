import { useState } from 'react'
import { Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMessages } from '@/shared/i18n'
import { useOrg } from '../lib/org-context'
import { ADMIN_SHELL_MESSAGES } from '../messages/shell'
import { OrgImportDialog } from './org-import-dialog'

// A fresh own installation without an organization (see
// lib/first-organization.ts): ask for its first one right here, instead of
// leaving an empty console — or import one from an export (e.g. a demo).
export function FirstOrganization() {
  const m = useMessages(ADMIN_SHELL_MESSAGES)
  const { addOrg, capabilities } = useOrg()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await addOrg(name.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto mt-10 max-w-md" data-testid="first-organization">
      <Card>
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg border">
            <Building2 className="size-5" aria-hidden="true" />
          </div>
          <CardTitle>{m.firstOrgTitle}</CardTitle>
          <CardDescription>{m.firstOrgText}</CardDescription>
        </CardHeader>
        <CardContent>
          {capabilities?.canCreateOrganization && (
            <form className="grid gap-3" onSubmit={create}>
              <Label htmlFor="first-org-name">{m.name}</Label>
              <Input id="first-org-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={m.orgNamePlaceholder} autoComplete="organization" autoFocus />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy ? m.busy : m.firstOrgCreate}
              </Button>
            </form>
          )}
          {capabilities?.canImportOrganization && (
            <button type="button" className="mt-4 text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => setImportOpen(true)}>
              {m.firstOrgImport}
            </button>
          )}
        </CardContent>
      </Card>
      <OrgImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}

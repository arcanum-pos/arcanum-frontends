import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { OrgImportDialog } from '../../components/org-import-dialog'
import { useOrg } from '../../lib/org-context'
import { downloadExport } from '../../lib/org-transfer'

// Gegevens: export all of this org's data (to move it to its own
// installation, or keep a copy), and import an export as a new org.
export default function DataPage() {
  const { currentOrg } = useOrg()
  const [includeSecrets, setIncludeSecrets] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  async function handleExport() {
    if (!currentOrg) return
    setExporting(true)
    setExportError(null)
    try {
      await downloadExport(currentOrg.id, includeSecrets)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">Gegevens</h2>
        <p className="text-sm text-muted-foreground">
          Al je gegevens meenemen — bijvoorbeeld naar een eigen Arcanum-installatie op je eigen Cloudflare-account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exporteren</CardTitle>
          <CardDescription>
            Eén leesbaar JSON-bestand met alle gegevens van {currentOrg?.name ?? 'deze organisatie'}: leden, evenementen, producten,
            menukaarten, rekeningen, bestellingen, betalingen en transacties.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Niet in de export</p>
            <ul className="mt-1 list-disc pl-5">
              <li>de versleutelingssleutel van de organisatie (een import maakt een nieuwe)</li>
              <li>het eigen domein en de identity provider — die horen bij een installatie</li>
              <li>toestellen (kassa's, klantschermen) — die registreren zich opnieuw</li>
              <li>leden komen bij een import terug als uitnodiging en worden actief bij hun eerste login</li>
            </ul>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 accent-primary"
              checked={includeSecrets}
              onChange={(e) => setIncludeSecrets(e.target.checked)}
            />
            <span>Inclusief geheimen (betaal- en mailinstellingen, onversleuteld)</span>
          </label>
          {includeSecrets && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              Het bestand bevat dan wachtwoorden en API-sleutels in leesbare vorm (Bancontact, SumUp, SMTP, Gmail). Bewaar het veilig,
              deel het niet, en verwijder het na de import.
            </p>
          )}

          <div>
            <Button onClick={handleExport} disabled={!currentOrg || exporting}>
              {exporting ? 'Bezig…' : 'Alle gegevens exporteren'}
            </Button>
          </div>
          {exportError && <p className="text-sm text-destructive">Export mislukt: {exportError}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Importeren</CardTitle>
          <CardDescription>
            Maakt een nieuwe organisatie aan met alle gegevens uit een exportbestand — van deze of een andere Arcanum-installatie. De huidige
            organisatie blijft ongewijzigd.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            Organisatie importeren uit exportbestand
          </Button>
        </CardContent>
      </Card>

      <OrgImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}

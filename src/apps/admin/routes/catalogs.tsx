import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { BookOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PromptDialog } from '../components/prompt-dialog'
import {
  archiveCatalog,
  createCatalog,
  duplicateCatalog,
  listCatalogs,
  renameCatalog,
  setDefaultCatalog,
  type CatalogSummary,
} from '../lib/catalog-api'
import { useOrg } from '../lib/org-context'
import { useAsync } from '../lib/use-async'

type Prompt = { kind: 'new' } | { kind: 'rename'; catalog: CatalogSummary } | { kind: 'duplicate'; catalog: CatalogSummary }

// Menukaarten: a selection of products with a price each, plus the kassa
// layout. Independent of events; exactly one is the org's standaard — what
// every kassa sells from unless the device picks another one.
export default function CatalogsPage() {
  const { currentOrg } = useOrg()
  const orgId = currentOrg?.id ?? null
  const navigate = useNavigate()
  const { data: catalogs, loading, error, reload } = useAsync(() => (orgId ? listCatalogs(orgId) : Promise.resolve([])), [orgId])
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function run(action: () => Promise<unknown>) {
    setActionError(null)
    try {
      await action()
      reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Menukaarten</h1>
          <p className="text-muted-foreground">Welke producten de kassa verkoopt, aan welke prijs en in welke groepen.</p>
        </div>
        <Button disabled={!orgId} onClick={() => setPrompt({ kind: 'new' })}>
          Nieuwe menukaart
        </Button>
      </div>

      {(error || actionError) && <p className="text-sm text-destructive">{actionError ?? `Kon menukaarten niet laden: ${error}`}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Naam</TableHead>
            <TableHead>Producten</TableHead>
            <TableHead className="text-right">Acties</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={3}>
                <Skeleton className="h-5 w-full" />
              </TableCell>
            </TableRow>
          )}
          {!loading && catalogs?.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2 py-6">
                  <BookOpen className="size-6" />
                  Nog geen menukaarten. De eerste wordt automatisch de standaard.
                </div>
              </TableCell>
            </TableRow>
          )}
          {!loading &&
            catalogs?.map((catalog) => (
              <TableRow key={catalog.id} data-testid={`catalog-${catalog.name}`}>
                <TableCell className="font-medium">
                  <Link to="/catalogs/$catalogId" params={{ catalogId: catalog.id }} className="underline-offset-4 hover:underline">
                    {catalog.name}
                  </Link>
                  {catalog.isDefault && <Badge className="ml-2">Standaard</Badge>}
                </TableCell>
                <TableCell>{catalog.entryCount}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/catalogs/$catalogId" params={{ catalogId: catalog.id }}>
                      Bewerken
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPrompt({ kind: 'rename', catalog })}>
                    Hernoemen
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPrompt({ kind: 'duplicate', catalog })}>
                    Dupliceren
                  </Button>
                  {!catalog.isDefault && (
                    <Button variant="ghost" size="sm" onClick={() => orgId && run(() => setDefaultCatalog(orgId, catalog.id))}>
                      Standaard maken
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => orgId && run(() => archiveCatalog(orgId, catalog.id))}>
                    Archiveren
                  </Button>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>

      {orgId && prompt?.kind === 'new' && (
        <PromptDialog
          key="new"
          title="Nieuwe menukaart"
          description="Bv. per seizoen of per evenement. Nadien voeg je groepen en producten toe."
          label="Naam"
          confirmLabel="Aanmaken"
          onConfirm={async (name) => {
            const created = await createCatalog(orgId, name)
            navigate({ to: '/catalogs/$catalogId', params: { catalogId: created.id } })
          }}
          onClose={() => setPrompt(null)}
        />
      )}
      {orgId && prompt?.kind === 'rename' && (
        <PromptDialog
          key={`rename-${prompt.catalog.id}`}
          title="Menukaart hernoemen"
          label="Naam"
          initialValue={prompt.catalog.name}
          confirmLabel="Opslaan"
          onConfirm={async (name) => {
            await renameCatalog(orgId, prompt.catalog.id, name)
            reload()
          }}
          onClose={() => setPrompt(null)}
        />
      )}
      {orgId && prompt?.kind === 'duplicate' && (
        <PromptDialog
          key={`duplicate-${prompt.catalog.id}`}
          title="Menukaart dupliceren"
          description="Een onafhankelijke kopie met dezelfde groepen en prijzen — bv. voor een nieuw seizoen."
          label="Naam van de kopie"
          initialValue={`${prompt.catalog.name} (kopie)`}
          confirmLabel="Dupliceren"
          onConfirm={async (name) => {
            await duplicateCatalog(orgId, prompt.catalog.id, name)
            reload()
          }}
          onClose={() => setPrompt(null)}
        />
      )}
    </div>
  )
}

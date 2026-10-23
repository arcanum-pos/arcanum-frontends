import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { BookOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMessages } from '@/shared/i18n'
import { downloadCatalogFile } from '../components/menu-export-button'
import { MenuImportDialog } from '../components/menu-import-dialog'
import { PromptDialog } from '../components/prompt-dialog'
import { RowActions } from '../components/row-actions'
import {
  archiveCatalog,
  createCatalog,
  duplicateCatalog,
  listCatalogs,
  renameCatalog,
  restoreCatalog,
  setDefaultCatalog,
  type CatalogSummary,
} from '../lib/catalog-api'
import { catalogNoticeText, serverNotice, type CatalogNotice } from '../lib/catalog-helpers'
import { useOrg } from '../lib/org-context'
import { useAsync } from '../lib/use-async'
import { ADMIN_CATALOG_MESSAGES } from '../messages/catalog'

type Prompt = { kind: 'new' } | { kind: 'import' } | { kind: 'rename'; catalog: CatalogSummary } | { kind: 'duplicate'; catalog: CatalogSummary }

// Menukaarten: a selection of products with a price each, plus the kassa
// layout. Independent of events; exactly one is the org's standaard — what
// every kassa sells from unless the device picks another one.
export default function CatalogsPage() {
  const m = useMessages(ADMIN_CATALOG_MESSAGES)
  const { currentOrg } = useOrg()
  const orgId = currentOrg?.id ?? null
  const navigate = useNavigate()
  // Archived ones only on "Toon gearchiveerd" — archiving is never for good.
  const [showArchived, setShowArchived] = useState(false)
  const { data: catalogs, loading, error, reload } = useAsync(() => (orgId ? listCatalogs(orgId, showArchived) : Promise.resolve([])), [orgId, showArchived])
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [actionError, setActionError] = useState<CatalogNotice | null>(null)

  async function run(action: () => Promise<unknown>) {
    setActionError(null)
    try {
      await action()
      reload()
    } catch (err) {
      setActionError(serverNotice(err))
    }
  }

  async function runExport(catalogId: string, format: 'xlsx' | 'csv') {
    if (!orgId) return
    setActionError(null)
    try {
      await downloadCatalogFile(orgId, catalogId, format)
    } catch (err) {
      setActionError({ kind: 'exportFailed', error: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{m.catalogsTitle}</h1>
          <p className="text-muted-foreground">{m.catalogsIntro}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="mr-2 flex items-center gap-2 text-sm">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} aria-label={m.showArchived} />
            {m.showArchived}
          </label>
          <Button variant="ghost" onClick={() => run(async () => (await import('../lib/menu-files')).downloadTemplate())}>
            {m.downloadTemplate}
          </Button>
          <Button variant="outline" disabled={!orgId} onClick={() => setPrompt({ kind: 'import' })}>
            {m.import}
          </Button>
          <Button disabled={!orgId} onClick={() => setPrompt({ kind: 'new' })}>
            {m.newCatalog}
          </Button>
        </div>
      </div>

      {(error || actionError) && <p className="text-sm text-destructive">{actionError ? catalogNoticeText(m, actionError) : m.catalogsLoadFailed(error ?? '')}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{m.name}</TableHead>
            <TableHead>{m.productsColumn}</TableHead>
            <TableHead className="w-10" />
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
                  {m.noCatalogs}
                </div>
              </TableCell>
            </TableRow>
          )}
          {!loading &&
            catalogs?.map((catalog) => (
              <TableRow key={catalog.id} data-testid={`catalog-${catalog.name}`} className={catalog.archived ? 'text-muted-foreground' : ''}>
                <TableCell className="font-medium">
                  <Link to="/catalogs/$catalogId" params={{ catalogId: catalog.id }} className="underline-offset-4 hover:underline">
                    {catalog.name}
                  </Link>
                  {catalog.isDefault && <Badge className="ml-2">{m.defaultBadge}</Badge>}
                  {catalog.archived && (
                    <Badge variant="outline" className="ml-2">
                      {m.archivedBadge}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{catalog.entryCount}</TableCell>
                <TableCell className="text-right">
                  {orgId && (
                    <RowActions
                      name={catalog.name}
                      actions={
                        catalog.archived
                          ? [{ label: m.restore, onSelect: () => run(() => restoreCatalog(orgId, catalog.id)) }]
                          : [
                              { label: m.edit, onSelect: () => navigate({ to: '/catalogs/$catalogId', params: { catalogId: catalog.id } }) },
                              { label: m.rename, onSelect: () => setPrompt({ kind: 'rename', catalog }) },
                              { label: m.duplicate, onSelect: () => setPrompt({ kind: 'duplicate', catalog }) },
                              !catalog.isDefault && { label: m.makeDefault, onSelect: () => run(() => setDefaultCatalog(orgId, catalog.id)) },
                              { label: m.exportAs('Excel'), onSelect: () => runExport(catalog.id, 'xlsx') },
                              { label: m.exportAs('CSV'), onSelect: () => runExport(catalog.id, 'csv') },
                              !catalog.isDefault && { label: m.archive, destructive: true, onSelect: () => run(() => archiveCatalog(orgId, catalog.id)) },
                            ]
                      }
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>

      {orgId && prompt?.kind === 'new' && (
        <PromptDialog
          key="new"
          title={m.newCatalog}
          description={m.newCatalogDescription}
          label={m.name}
          confirmLabel={m.create}
          onConfirm={async (name) => {
            const created = await createCatalog(orgId, name)
            navigate({ to: '/catalogs/$catalogId', params: { catalogId: created.id } })
          }}
          onClose={() => setPrompt(null)}
        />
      )}
      {orgId && prompt?.kind === 'import' && (
        <MenuImportDialog
          orgId={orgId}
          target={{ kind: 'new' }}
          onClose={() => setPrompt(null)}
          onApplied={(created) => {
            setPrompt(null)
            if (created.id) navigate({ to: '/catalogs/$catalogId', params: { catalogId: created.id } })
            else reload()
          }}
        />
      )}
      {orgId && prompt?.kind === 'rename' && (
        <PromptDialog
          key={`rename-${prompt.catalog.id}`}
          title={m.renameCatalog}
          label={m.name}
          initialValue={prompt.catalog.name}
          confirmLabel={m.save}
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
          title={m.duplicateCatalog}
          description={m.duplicateDescription}
          label={m.copyName}
          initialValue={m.copyOf(prompt.catalog.name)}
          confirmLabel={m.duplicate}
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

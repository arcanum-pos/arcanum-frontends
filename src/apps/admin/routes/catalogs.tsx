import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { BookOpen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMessages } from '@/shared/i18n'
import { MenuExportButton } from '../components/menu-export-button'
import { MenuImportDialog } from '../components/menu-import-dialog'
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
  const { data: catalogs, loading, error, reload } = useAsync(() => (orgId ? listCatalogs(orgId) : Promise.resolve([])), [orgId])
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{m.catalogsTitle}</h1>
          <p className="text-muted-foreground">{m.catalogsIntro}</p>
        </div>
        <div className="flex flex-wrap gap-2">
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
            <TableHead className="text-right">{m.actions}</TableHead>
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
              <TableRow key={catalog.id} data-testid={`catalog-${catalog.name}`}>
                <TableCell className="font-medium">
                  <Link to="/catalogs/$catalogId" params={{ catalogId: catalog.id }} className="underline-offset-4 hover:underline">
                    {catalog.name}
                  </Link>
                  {catalog.isDefault && <Badge className="ml-2">{m.defaultBadge}</Badge>}
                </TableCell>
                <TableCell>{catalog.entryCount}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/catalogs/$catalogId" params={{ catalogId: catalog.id }}>
                      {m.edit}
                    </Link>
                  </Button>
                  {orgId && <MenuExportButton orgId={orgId} catalogId={catalog.id} variant="ghost" size="sm" onError={setActionError} />}
                  <Button variant="ghost" size="sm" onClick={() => setPrompt({ kind: 'rename', catalog })}>
                    {m.rename}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPrompt({ kind: 'duplicate', catalog })}>
                    {m.duplicate}
                  </Button>
                  {!catalog.isDefault && (
                    <Button variant="ghost" size="sm" onClick={() => orgId && run(() => setDefaultCatalog(orgId, catalog.id))}>
                      {m.makeDefault}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => orgId && run(() => archiveCatalog(orgId, catalog.id))}>
                    {m.archive}
                  </Button>
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

import { useState, type KeyboardEvent } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { ArrowDown, ArrowLeft, ArrowUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { MenuExportButton } from '../components/menu-export-button'
import { MenuImportDialog } from '../components/menu-import-dialog'
import { ConfirmDialog, PromptDialog } from '../components/prompt-dialog'
import {
  createEntry,
  createSection,
  deleteEntry,
  deleteSection,
  getCatalog,
  listProducts,
  renameSection,
  setCatalogLayout,
  updateEntry,
  type CatalogDetail,
  type CatalogEntry,
  type CatalogSection,
  type LayoutPayload,
} from '../lib/catalog-api'
import {
  addableVariants,
  formatEuroInput,
  formatQuickQuantities,
  moveEntryInLayout,
  moveSectionInLayout,
  parseEuroInput,
  parseQuickQuantities,
} from '../lib/catalog-helpers'
import { useOrg } from '../lib/org-context'
import { useAsync } from '../lib/use-async'

type Prompt = { kind: 'new-section' } | { kind: 'import' } | { kind: 'rename-section'; section: CatalogSection } | { kind: 'delete-section'; section: CatalogSection }

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// One menukaart: groepen (sections — the kassa's button groups) with their
// lines (a product variant + its price here). Every change is saved right
// away and the whole catalog is reloaded afterwards, so what's shown is
// always what the server has.
export default function CatalogEditorPage() {
  const { catalogId } = useParams({ strict: false }) as { catalogId: string }
  const { currentOrg } = useOrg()
  const orgId = currentOrg?.id ?? null

  const catalog = useAsync(() => (orgId ? getCatalog(orgId, catalogId) : Promise.resolve(null)), [orgId, catalogId])
  const products = useAsync(() => (orgId ? listProducts(orgId) : Promise.resolve([])), [orgId])
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function run(action: () => Promise<unknown>) {
    setActionError(null)
    try {
      await action()
    } catch (err) {
      setActionError(errorText(err))
    } finally {
      // Also after a failure — e.g. the layout call's "gewijzigd, herlaad"
      // (someone else edited meanwhile) is then fixed by the reload itself.
      catalog.reload()
    }
  }

  function layout(payload: LayoutPayload) {
    if (orgId) run(() => setCatalogLayout(orgId, catalogId, payload))
  }

  const data: CatalogDetail | null = catalog.data

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link to="/catalogs" className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="size-4" /> Menukaarten
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{data?.name ?? 'Menukaart'}</h1>
            {data?.isDefault && <Badge>Standaard</Badge>}
          </div>
          <div className="flex flex-wrap gap-2">
            {orgId && data && <MenuExportButton orgId={orgId} catalogId={data.id} onError={setActionError} />}
            <Button variant="outline" disabled={!data} onClick={() => setPrompt({ kind: 'import' })}>
              Importeren
            </Button>
            <Button disabled={!data} onClick={() => setPrompt({ kind: 'new-section' })}>
              Groep toevoegen
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground">Groepen zijn de knoppenblokken op de kassa. Prijzen gelden alleen op deze menukaart.</p>
      </div>

      {catalog.loading && !data && <Skeleton className="h-24 w-full" />}
      {catalog.error && <p className="text-sm text-destructive">Kon menukaart niet laden: {catalog.error}</p>}
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {data && data.sections.length === 0 && <p className="text-sm text-muted-foreground">Nog geen groepen. Voeg er een toe, bv. “Drank”.</p>}

      {orgId &&
        data?.sections.map((section, sectionIndex) => (
          <Card key={section.id} data-testid={`section-${section.name}`}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">{section.name}</CardTitle>
              <div className="flex flex-wrap gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${section.name} omhoog`}
                  disabled={sectionIndex === 0}
                  onClick={() => layout(moveSectionInLayout(data.sections, sectionIndex, -1))}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${section.name} omlaag`}
                  disabled={sectionIndex === data.sections.length - 1}
                  onClick={() => layout(moveSectionInLayout(data.sections, sectionIndex, 1))}
                >
                  <ArrowDown />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPrompt({ kind: 'rename-section', section })}>
                  Hernoemen
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPrompt({ kind: 'delete-section', section })}>
                  Verwijderen
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {section.entries.length === 0 && <p className="text-sm text-muted-foreground">Nog geen producten in deze groep.</p>}
              {section.entries.map((entry, entryIndex) => (
                <EntryRow
                  key={`${entry.id}-${entry.priceCents}-${formatQuickQuantities(entry.quickQuantities)}`}
                  entry={entry}
                  first={entryIndex === 0}
                  last={entryIndex === section.entries.length - 1}
                  onMove={(delta) => layout(moveEntryInLayout(data.sections, section.id, entryIndex, delta))}
                  onUpdate={(fields) => run(() => updateEntry(orgId, catalogId, entry.id, fields))}
                  onRemove={() => run(() => deleteEntry(orgId, catalogId, entry.id))}
                  onError={setActionError}
                />
              ))}
              <AddEntryForm
                options={addableVariants(products.data ?? [], data.sections)}
                onAdd={(variantId, priceCents) => run(() => createEntry(orgId, catalogId, { sectionId: section.id, variantId, priceCents }))}
                sectionName={section.name}
              />
            </CardContent>
          </Card>
        ))}

      {orgId && data && prompt?.kind === 'import' && (
        <MenuImportDialog
          orgId={orgId}
          target={{ kind: 'replace', catalogId: data.id, catalogName: data.name }}
          onClose={() => setPrompt(null)}
          onApplied={() => {
            setPrompt(null)
            catalog.reload()
            products.reload()
          }}
        />
      )}
      {orgId && prompt?.kind === 'new-section' && (
        <PromptDialog
          key="new-section"
          title="Groep toevoegen"
          description="Een knoppenblok op de kassa, bv. Drank, Eten of Bonnen."
          label="Naam"
          confirmLabel="Toevoegen"
          onConfirm={async (name) => {
            await createSection(orgId, catalogId, name)
            catalog.reload()
          }}
          onClose={() => setPrompt(null)}
        />
      )}
      {orgId && prompt?.kind === 'rename-section' && (
        <PromptDialog
          key={`rename-${prompt.section.id}`}
          title="Groep hernoemen"
          label="Naam"
          initialValue={prompt.section.name}
          confirmLabel="Opslaan"
          onConfirm={async (name) => {
            await renameSection(orgId, catalogId, prompt.section.id, name)
            catalog.reload()
          }}
          onClose={() => setPrompt(null)}
        />
      )}
      {orgId && prompt?.kind === 'delete-section' && (
        <ConfirmDialog
          title={`Groep “${prompt.section.name}” verwijderen?`}
          description={`De ${prompt.section.entries.length} product(en) in deze groep verdwijnen van deze menukaart. De producten zelf blijven bestaan.`}
          confirmLabel="Verwijderen"
          onConfirm={async () => {
            await deleteSection(orgId, catalogId, prompt.section.id)
            catalog.reload()
          }}
          onClose={() => setPrompt(null)}
        />
      )}
    </div>
  )
}

// One line: price (euro, comma or dot) and quick quantities are saved on
// Enter or when leaving the field; visibility saves on toggle. Remounted
// (via key) whenever the saved values change, so its inputs reset to them.
function EntryRow({
  entry,
  first,
  last,
  onMove,
  onUpdate,
  onRemove,
  onError,
}: {
  entry: CatalogEntry
  first: boolean
  last: boolean
  onMove: (delta: number) => void
  onUpdate: (fields: { priceCents?: number; visible?: boolean; quickQuantities?: number[] | null }) => void
  onRemove: () => void
  onError: (message: string) => void
}) {
  const [price, setPrice] = useState(formatEuroInput(entry.priceCents))
  const [quick, setQuick] = useState(formatQuickQuantities(entry.quickQuantities))

  function savePrice() {
    const cents = parseEuroInput(price)
    if (cents === null) {
      onError(`Ongeldige prijs voor ${entry.displayName} — gebruik bv. 2,50`)
      return
    }
    if (cents !== entry.priceCents) onUpdate({ priceCents: cents })
  }

  function saveQuick() {
    const parsed = parseQuickQuantities(quick)
    if (parsed && !Array.isArray(parsed)) {
      onError(parsed.error)
      return
    }
    if (formatQuickQuantities(parsed) !== formatQuickQuantities(entry.quickQuantities)) onUpdate({ quickQuantities: parsed })
  }

  const blurOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
  }

  return (
    <div data-testid={`entry-${entry.displayName}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b py-2 last:border-b-0">
      <div className="min-w-40 flex-1">
        <p className={`font-medium ${entry.sellable ? '' : 'text-muted-foreground line-through'}`}>{entry.displayName}</p>
        <p className="text-xs text-muted-foreground">
          {entry.categoryName ?? 'Geen categorie'}
          {entry.code && ` · ${entry.code}`}
        </p>
        {!entry.sellable && (
          <Badge variant="destructive" className="mt-1">
            Gearchiveerd product — niet op de kassa
          </Badge>
        )}
      </div>
      <label className="flex items-center gap-1 text-sm">
        €
        <Input
          aria-label={`Prijs ${entry.displayName}`}
          inputMode="decimal"
          className="w-24"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={savePrice}
          onKeyDown={blurOnEnter}
        />
      </label>
      <Input
        aria-label={`Snelknoppen ${entry.displayName}`}
        placeholder="snelknoppen, bv. 5, 10"
        className="w-40"
        value={quick}
        onChange={(e) => setQuick(e.target.value)}
        onBlur={saveQuick}
        onKeyDown={blurOnEnter}
      />
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={entry.visible} onCheckedChange={(visible) => onUpdate({ visible })} aria-label={`Zichtbaar ${entry.displayName}`} />
        Zichtbaar
      </label>
      <div className="flex">
        <Button variant="ghost" size="icon-sm" aria-label={`${entry.displayName} omhoog`} disabled={first} onClick={() => onMove(-1)}>
          <ArrowUp />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={`${entry.displayName} omlaag`} disabled={last} onClick={() => onMove(1)}>
          <ArrowDown />
        </Button>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          Verwijderen
        </Button>
      </div>
    </div>
  )
}

function AddEntryForm({
  options,
  sectionName,
  onAdd,
}: {
  options: { variantId: string; label: string }[]
  sectionName: string
  onAdd: (variantId: string, priceCents: number) => void
}) {
  const [variantId, setVariantId] = useState('')
  const [price, setPrice] = useState('')
  const cents = parseEuroInput(price)

  if (options.length === 0) {
    return <p className="pt-2 text-xs text-muted-foreground">Alle producten staan al op deze menukaart — maak nieuwe aan onder Producten.</p>
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2 pt-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!variantId || cents === null) return
        onAdd(variantId, cents)
        setVariantId('')
        setPrice('')
      }}
    >
      <Select value={variantId} onValueChange={setVariantId}>
        <SelectTrigger className="w-56" aria-label={`Product toevoegen aan ${sectionName}`}>
          <SelectValue placeholder="Product toevoegen…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.variantId} value={o.variantId}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label className="flex items-center gap-1 text-sm">
        €
        <Input aria-label={`Prijs nieuw product ${sectionName}`} inputMode="decimal" placeholder="0,00" className="w-24" value={price} onChange={(e) => setPrice(e.target.value)} />
      </label>
      <Button type="submit" variant="outline" disabled={!variantId || cents === null}>
        Toevoegen
      </Button>
    </form>
  )
}

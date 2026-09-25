import { useState } from 'react'
import { Package } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PromptDialog } from '../components/prompt-dialog'
import {
  createCategory,
  createProduct,
  createVariant,
  deleteCategory,
  listCategories,
  listProducts,
  updateCategory,
  updateProduct,
  updateVariant,
  type Category,
  type Product,
} from '../lib/catalog-api'
import { VAT_OPTIONS, vatLabel } from '../lib/catalog-helpers'
import { useOrg } from '../lib/org-context'
import { useAsync } from '../lib/use-async'

// Radix Select can't use '' as a value, so "none" stands in for null.
const NONE = 'none'

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// Products are defined once per org (DOMAIN_MODEL.md) — prices live on each
// menukaart, not here. Every product has at least one variant; a
// single-version product has one with an empty name.
export default function ProductsPage() {
  const { currentOrg } = useOrg()
  const orgId = currentOrg?.id ?? null
  const [showArchived, setShowArchived] = useState(false)

  const categories = useAsync(() => (orgId ? listCategories(orgId) : Promise.resolve([])), [orgId])
  const products = useAsync(() => (orgId ? listProducts(orgId, showArchived) : Promise.resolve([])), [orgId, showArchived])

  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function run(action: () => Promise<unknown>) {
    setActionError(null)
    try {
      await action()
      products.reload()
    } catch (err) {
      setActionError(errorText(err))
    }
  }

  const categoryName = (id: string | null) => categories.data?.find((c) => c.id === id)?.name ?? '—'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Producten</h1>
        <p className="text-muted-foreground">Wat {currentOrg?.name ?? 'deze organisatie'} verkoopt. Prijzen stel je per menukaart in.</p>
      </div>

      {orgId && <CategoriesCard orgId={orgId} categories={categories.data} loading={categories.loading} error={categories.error} onChanged={categories.reload} />}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Producten</h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={showArchived} onCheckedChange={setShowArchived} aria-label="Toon gearchiveerd" />
              Toon gearchiveerd
            </label>
            <Button disabled={!orgId} onClick={() => setEditing('new')}>
              Nieuw product
            </Button>
          </div>
        </div>

        {(products.error || actionError) && <p className="text-sm text-destructive">{actionError ?? `Kon producten niet laden: ${products.error}`}</p>}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Naam</TableHead>
              <TableHead>Categorie</TableHead>
              <TableHead>BTW</TableHead>
              <TableHead>Varianten</TableHead>
              <TableHead className="text-right">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.loading && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            )}
            {!products.loading && products.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2 py-6">
                    <Package className="size-6" />
                    Nog geen producten.
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!products.loading &&
              products.data?.map((product) => (
                <TableRow key={product.id} data-testid={`product-${product.name}`} className={product.archived ? 'text-muted-foreground' : ''}>
                  <TableCell className="font-medium">
                    {product.name}
                    {product.archived && (
                      <Badge variant="outline" className="ml-2">
                        gearchiveerd
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{categoryName(product.categoryId)}</TableCell>
                  <TableCell>{vatLabel(product.vatRateBp)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {product.variants
                        .filter((v) => !v.archived)
                        .map((v) => (
                          <Badge key={v.id} variant="secondary">
                            {v.name || 'standaard'}
                            {v.code && <span className="ml-1 opacity-70">· {v.code}</span>}
                          </Badge>
                        ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {!product.archived && (
                      <Button variant="ghost" size="sm" onClick={() => setEditing(product)}>
                        Bewerken
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => orgId && run(() => updateProduct(orgId, product.id, { archived: !product.archived }))}
                    >
                      {product.archived ? 'Terugzetten' : 'Archiveren'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">BTW-tarieven zijn voorlopig — nog te bevestigen met de boekhouder.</p>
      </div>

      {orgId && editing && (
        <ProductDialog
          key={editing === 'new' ? 'new' : editing.id}
          orgId={orgId}
          product={editing === 'new' ? null : editing}
          categories={categories.data ?? []}
          onSaved={products.reload}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function CategoriesCard({
  orgId,
  categories,
  loading,
  error,
  onChanged,
}: {
  orgId: string
  categories: Category[] | null
  loading: boolean
  error: string | null
  onChanged: () => void
}) {
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState<Category | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function run(action: () => Promise<unknown>) {
    setActionError(null)
    try {
      await action()
      onChanged()
    } catch (err) {
      setActionError(errorText(err))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Categorieën</CardTitle>
        <p className="text-sm text-muted-foreground">Wat een product is (Drank, Eten, Inschrijvingen) — voor rapporten, later ook voor keuken/bar.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loading && <Skeleton className="h-5 w-full" />}
        {error && <p className="text-sm text-destructive">Kon categorieën niet laden: {error}</p>}
        {!loading && categories?.length === 0 && <p className="text-sm text-muted-foreground">Nog geen categorieën.</p>}
        <div className="flex flex-col">
          {categories?.map((c) => (
            <div key={c.id} data-testid={`category-${c.name}`} className="flex items-center justify-between gap-2 border-b py-2 last:border-b-0">
              <span className="font-medium">{c.name}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setRenaming(c)}>
                  Hernoemen
                </Button>
                <Button variant="ghost" size="sm" onClick={() => run(() => deleteCategory(orgId, c.id))}>
                  Verwijderen
                </Button>
              </div>
            </div>
          ))}
        </div>
        {actionError && <p className="text-sm text-destructive">{actionError}</p>}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            run(async () => {
              await createCategory(orgId, name.trim())
              setName('')
            })
          }}
        >
          <Input aria-label="Nieuwe categorie" placeholder="Nieuwe categorie, bv. Drank" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" variant="outline" disabled={!name.trim()}>
            Toevoegen
          </Button>
        </form>
      </CardContent>
      {renaming && (
        <PromptDialog
          key={renaming.id}
          title="Categorie hernoemen"
          label="Naam"
          initialValue={renaming.name}
          confirmLabel="Opslaan"
          onConfirm={async (value) => {
            await updateCategory(orgId, renaming.id, { name: value })
            onChanged()
          }}
          onClose={() => setRenaming(null)}
        />
      )}
    </Card>
  )
}

interface VariantDraft {
  name: string
  code: string
}

// Create: name, category, BTW and the initial variants in one go. Edit:
// the product fields, plus each existing variant saved/archived on its own
// (a variant can't be deleted — order lines point at it).
function ProductDialog({
  orgId,
  product,
  categories,
  onSaved,
  onClose,
}: {
  orgId: string
  product: Product | null
  categories: Category[]
  onSaved: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(product?.name ?? '')
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? NONE)
  const [vat, setVat] = useState(product?.vatRateBp != null ? String(product.vatRateBp) : NONE)
  const [newVariants, setNewVariants] = useState<VariantDraft[]>(product ? [] : [{ name: '', code: '' }])
  const [variantEdits, setVariantEdits] = useState<Record<string, VariantDraft>>(() =>
    Object.fromEntries((product?.variants ?? []).map((v) => [v.id, { name: v.name, code: v.code ?? '' }]))
  )
  const [current, setCurrent] = useState(product)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const fields = () => ({
    name: name.trim(),
    categoryId: categoryId === NONE ? null : categoryId,
    vatRateBp: vat === NONE ? null : Number(vat),
  })

  function save() {
    if (!name.trim()) return
    run(async () => {
      if (current) {
        await updateProduct(orgId, current.id, fields())
      } else {
        const variants = newVariants.filter((v, i) => i === 0 || v.name.trim() || v.code.trim())
        await createProduct(orgId, { ...fields(), variants: variants.map((v) => ({ name: v.name.trim(), code: v.code.trim() || null })) })
      }
      onSaved()
      onClose()
    })
  }

  function replaceVariant(updated: Product['variants'][number]) {
    setCurrent((p) => (p ? { ...p, variants: p.variants.map((v) => (v.id === updated.id ? updated : v)) } : p))
    onSaved()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{current ? 'Product bewerken' : 'Nieuw product'}</DialogTitle>
          <DialogDescription>Prijzen stel je per menukaart in, niet hier.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="product-name">Naam</Label>
            <Input id="product-name" autoComplete="off" maxLength={100} placeholder="bv. Fietstocht" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="product-category">Categorie</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="product-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Geen</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="product-vat">BTW</Label>
              <Select value={vat} onValueChange={setVat}>
                <SelectTrigger id="product-vat" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VAT_OPTIONS.map((o) => (
                    <SelectItem key={o.label} value={o.value === null ? NONE : String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Varianten</Label>
            <p className="text-xs text-muted-foreground">
              Bv. niet-lid / lid, of volwassene / kind. Laat de naam leeg voor een product met één versie. De code is optioneel (voor “typ een code”).
            </p>

            {current?.variants.map((v) => {
              const edit = variantEdits[v.id] ?? { name: v.name, code: v.code ?? '' }
              return (
                <div key={v.id} className={`flex flex-wrap items-center gap-2 ${v.archived ? 'opacity-60' : ''}`}>
                  <Input
                    aria-label="Variantnaam"
                    className="w-36"
                    placeholder="standaard"
                    value={edit.name}
                    disabled={v.archived}
                    onChange={(e) => setVariantEdits((p) => ({ ...p, [v.id]: { ...edit, name: e.target.value } }))}
                  />
                  <Input
                    aria-label="Variantcode"
                    className="w-32"
                    placeholder="code"
                    value={edit.code}
                    disabled={v.archived}
                    onChange={(e) => setVariantEdits((p) => ({ ...p, [v.id]: { ...edit, code: e.target.value } }))}
                  />
                  {!v.archived && (edit.name !== v.name || edit.code !== (v.code ?? '')) && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => run(async () => replaceVariant(await updateVariant(orgId, v.id, { name: edit.name.trim(), code: edit.code.trim() || null })))}
                    >
                      Opslaan
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(async () => replaceVariant(await updateVariant(orgId, v.id, { archived: !v.archived })))}>
                    {v.archived ? 'Terugzetten' : 'Archiveren'}
                  </Button>
                </div>
              )
            })}

            {newVariants.map((v, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label="Nieuwe variantnaam"
                  className="w-36"
                  placeholder={current ? 'nieuwe variant' : 'standaard'}
                  value={v.name}
                  onChange={(e) => setNewVariants((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                />
                <Input
                  aria-label="Nieuwe variantcode"
                  className="w-32"
                  placeholder="code"
                  value={v.code}
                  onChange={(e) => setNewVariants((p) => p.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))}
                />
                {current ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || !v.name.trim()}
                    onClick={() =>
                      run(async () => {
                        const created = await createVariant(orgId, current.id, { name: v.name.trim(), code: v.code.trim() || null })
                        setCurrent((p) => (p ? { ...p, variants: [...p.variants, created] } : p))
                        setVariantEdits((p) => ({ ...p, [created.id]: { name: created.name, code: created.code ?? '' } }))
                        setNewVariants((p) => p.filter((_, j) => j !== i))
                        onSaved()
                      })
                    }
                  >
                    Toevoegen
                  </Button>
                ) : (
                  newVariants.length > 1 && (
                    <Button size="sm" variant="ghost" onClick={() => setNewVariants((p) => p.filter((_, j) => j !== i))}>
                      Weg
                    </Button>
                  )
                )}
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => setNewVariants((p) => [...p, { name: '', code: '' }])}>
              + Variant
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuleren
          </Button>
          <Button onClick={save} disabled={busy || !name.trim()}>
            {busy ? 'Bezig...' : current ? 'Opslaan' : 'Aanmaken'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

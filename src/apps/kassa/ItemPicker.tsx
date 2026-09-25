import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatEuro } from '@/shared/format'
import type { KassaCatalog, KassaEntry } from './catalog-api'
import { entryToPickerItem, FOOI_CODE, readAmountCents, type PickerItem } from './lib'

export type CatalogState = { status: 'loading' } | { status: 'none' } | { status: 'error'; message: string } | { status: 'ok'; catalog: KassaCatalog }

// Left half of the kassa: the loaded catalog, one card per section, taps
// add to the active tab's draft. The tab panel on the right only ever sees
// generic lines. An entry with quick quantities (e.g. 5/10/…/40 bonnen)
// gets a row of "sell N at once" buttons instead of a single button.
export function ItemPicker({
  catalogState,
  disabled,
  onAdd,
}: {
  catalogState: CatalogState
  disabled: boolean
  onAdd: (item: PickerItem, quantity: number) => void
}) {
  const [fooiInput, setFooiInput] = useState('')

  function addFooi() {
    const amount = readAmountCents(fooiInput)
    if (amount < 1) return
    onAdd({ itemCode: FOOI_CODE, name: 'Fooi', unitPriceCents: amount }, 1)
    setFooiInput('')
  }

  return (
    <div className="flex flex-col gap-4">
      {catalogState.status === 'loading' && <p className="py-6 text-center text-sm text-muted-foreground">Menukaart laden…</p>}
      {catalogState.status === 'none' && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">Nog geen menukaart — een beheerder maakt er een in de console.</CardContent>
        </Card>
      )}
      {catalogState.status === 'error' && <p className="text-sm font-medium text-destructive">{catalogState.message}</p>}

      {catalogState.status === 'ok' &&
        catalogState.catalog.sections.map((section) => {
          const quick = section.entries.filter((e) => e.quickQuantities?.length)
          const plain = section.entries.filter((e) => !e.quickQuantities?.length)
          return (
            <Card key={section.id}>
              <CardHeader>
                <CardTitle className="text-base">{section.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {quick.map((entry) => (
                  <QuickEntry key={entry.entryId} entry={entry} disabled={disabled} onAdd={onAdd} />
                ))}
                {plain.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {plain.map((entry) => (
                      <Button
                        key={entry.entryId}
                        type="button"
                        variant="outline"
                        className="h-auto flex-col items-start gap-0.5 py-3 text-left whitespace-normal"
                        disabled={disabled}
                        onClick={() => onAdd(entryToPickerItem(entry), 1)}
                      >
                        <span className="font-medium">{entry.name}</span>
                        <span className="text-sm text-muted-foreground">{formatEuro(entry.priceCents)}</span>
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fooi</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              addFooi()
            }}
          >
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Bedrag, bv. 2,50"
              value={fooiInput}
              onChange={(e) => setFooiInput(e.target.value)}
              disabled={disabled}
            />
            <Button type="submit" variant="outline" disabled={disabled || readAmountCents(fooiInput) < 1}>
              Toevoegen
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function QuickEntry({ entry, disabled, onAdd }: { entry: KassaEntry; disabled: boolean; onAdd: (item: PickerItem, quantity: number) => void }) {
  const item = entryToPickerItem(entry)
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {entry.name} · {formatEuro(entry.priceCents)} per stuk
      </p>
      <div className="grid grid-cols-4 gap-2">
        {entry.quickQuantities!.map((n) => (
          <Button key={n} type="button" variant="outline" className="h-12" aria-label={`${n} × ${entry.name}`} disabled={disabled} onClick={() => onAdd(item, n)}>
            {n}
          </Button>
        ))}
      </div>
    </div>
  )
}

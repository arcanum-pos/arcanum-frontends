import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatEuro } from '@/shared/format'
import { FOOI_CODE, pickerItems, readAmountCents, type PickerItem, type Pricing } from './lib'

const BON_QUANTITIES = [5, 10, 15, 20, 25, 30, 35, 40]

// Left half of the kassa: taps add to the active tab's draft. Becomes the
// catalog button grid in step 3 (DOMAIN_MODEL.md) — the tab panel on the
// right only ever sees generic lines, so it doesn't change when this does.
export function ItemPicker({
  pricing,
  disabled,
  onAdd,
}: {
  pricing: Pricing
  disabled: boolean
  onAdd: (item: PickerItem, quantity: number) => void
}) {
  const [fooiInput, setFooiInput] = useState('')
  const items = pickerItems(pricing)
  const bon = items[0]

  function addFooi() {
    const amount = readAmountCents(fooiInput)
    if (amount < 1) return
    onAdd({ itemCode: FOOI_CODE, name: 'Fooi', unitPriceCents: amount }, 1)
    setFooiInput('')
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bonnen</CardTitle>
          <p className="text-sm text-muted-foreground">{formatEuro(pricing.amountPerBonCents)} per bon</p>
        </CardHeader>
        <CardContent className="grid grid-cols-4 gap-2">
          {BON_QUANTITIES.map((n) => (
            <Button key={n} type="button" variant="outline" className="h-12" disabled={disabled} onClick={() => onAdd(bon, n)}>
              {n}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Producten</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          {items.map((item) => (
            <Button
              key={item.itemCode}
              type="button"
              variant="outline"
              className="h-auto flex-col items-start gap-0.5 py-3 text-left"
              disabled={disabled}
              onClick={() => onAdd(item, 1)}
            >
              <span className="font-medium">{item.name}</span>
              <span className="text-sm text-muted-foreground">{formatEuro(item.unitPriceCents)}</span>
            </Button>
          ))}
        </CardContent>
      </Card>

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

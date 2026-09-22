import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatEuro, pluralize } from '@/shared/format'
import { buildBreakdownLines, itemsTotalCents, readAmountCents, type OrderItems, type PaymentMethod, type Pricing } from './lib'

const BON_QUANTITIES = [5, 10, 15, 20, 25, 30, 35, 40]

const GENERATE_LABELS: Record<PaymentMethod, string> = {
  bancontact: 'Bancontact QR code aanmaken',
  cash: 'Cash betaling aanmaken',
  sumup: 'SumUp betaling aanmaken',
}

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'bancontact', label: 'Bancontact' },
  { value: 'cash', label: 'Contant' },
  { value: 'sumup', label: 'SumUp' },
]

function ItemStepper({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string
  hint: string
  value: number
  onChange: (value: number) => void
  disabled: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-3 last:border-b-0">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`minder ${label.toLowerCase()}`}
          disabled={disabled}
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          −
        </Button>
        <Input
          type="number"
          min={0}
          step={1}
          value={value}
          onChange={(e) => onChange(Math.max(0, Math.round(Number(e.target.value)) || 0))}
          className="w-16 text-center"
        />
        <Button type="button" variant="outline" size="icon" aria-label={`meer ${label.toLowerCase()}`} disabled={disabled} onClick={() => onChange(value + 1)}>
          +
        </Button>
      </div>
    </div>
  )
}

export function OrderBuilder({
  pricing,
  paymentMethod,
  onPaymentMethodChange,
  onGenerate,
  onError,
  busy,
}: {
  pricing: Pricing
  paymentMethod: PaymentMethod
  onPaymentMethodChange: (method: PaymentMethod) => void
  onGenerate: (amountCents: number, description: string, items: OrderItems) => void
  onError: (message: string) => void
  busy: boolean
}) {
  const [bonnen, setBonnen] = useState(0)
  const [fietstocht, setFietstocht] = useState(0)
  const [fietstochtMember, setFietstochtMember] = useState(0)
  const [wandeltocht, setWandeltocht] = useState(0)
  const [wandeltochtMember, setWandeltochtMember] = useState(0)
  const [fooiInput, setFooiInput] = useState('0')

  const fooi = readAmountCents(fooiInput)
  const items: OrderItems = {
    bon: bonnen || undefined,
    fietstocht: fietstocht || undefined,
    fietstochtMember: fietstochtMember || undefined,
    wandeltocht: wandeltocht || undefined,
    wandeltochtMember: wandeltochtMember || undefined,
    fooi: fooi || undefined,
  }
  const total = itemsTotalCents(items, pricing)
  const breakdown = buildBreakdownLines(items, pricing)

  function handleGenerate() {
    if (bonnen < 1 && fietstocht < 1 && fietstochtMember < 1 && wandeltocht < 1 && wandeltochtMember < 1 && fooi < 1) {
      onError('Voer minstens één aantal of bedrag groter dan 0 in.')
      return
    }

    const descriptionParts: string[] = []
    if (bonnen > 0) descriptionParts.push(`${bonnen} bon${bonnen === 1 ? '' : 'nen'}`)
    if (fietstocht > 0) descriptionParts.push(`${fietstocht} ${pluralize(fietstocht, 'fietstocht', 'fietstochten')}`)
    if (fietstochtMember > 0) descriptionParts.push(`${fietstochtMember} ${pluralize(fietstochtMember, 'fietstocht', 'fietstochten')} (lid)`)
    if (wandeltocht > 0) descriptionParts.push(`${wandeltocht} ${pluralize(wandeltocht, 'wandeltocht', 'wandeltochten')}`)
    if (wandeltochtMember > 0) descriptionParts.push(`${wandeltochtMember} ${pluralize(wandeltochtMember, 'wandeltocht', 'wandeltochten')} (lid)`)
    if (fooi > 0) descriptionParts.push(`fooi ${formatEuro(fooi)}`)

    onGenerate(total, descriptionParts.join(' + '), items)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Betaalmethode</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          {PAYMENT_METHOD_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="payment-method"
                value={opt.value}
                checked={paymentMethod === opt.value}
                onChange={() => onPaymentMethodChange(opt.value)}
                autoComplete="off"
                className="accent-primary"
              />
              {opt.label}
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bonnen</CardTitle>
          <p className="text-sm text-muted-foreground">{formatEuro(pricing.amountPerBonCents)}</p>
        </CardHeader>
        <CardContent className="grid grid-cols-4 gap-2">
          {BON_QUANTITIES.map((n) => (
            <Button
              key={n}
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onGenerate(n * pricing.amountPerBonCents, `${n} bonnen`, { bon: n })}
            >
              {n} bonnen
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bestelling samenstellen</CardTitle>
          <p className="text-sm text-muted-foreground">Kies aantallen en maak één betaling aan voor het totaal.</p>
        </CardHeader>
        <CardContent className="flex flex-col">
          <ItemStepper label="Bonnen" hint={formatEuro(pricing.amountPerBonCents)} value={bonnen} onChange={setBonnen} disabled={busy} />
          <ItemStepper
            label="Fietstocht"
            hint={formatEuro(pricing.fietstochtNonMemberCents)}
            value={fietstocht}
            onChange={setFietstocht}
            disabled={busy}
          />
          <ItemStepper
            label="Fietstocht (lid)"
            hint={formatEuro(pricing.fietstochtMemberCents)}
            value={fietstochtMember}
            onChange={setFietstochtMember}
            disabled={busy}
          />
          <ItemStepper
            label="Wandeltocht"
            hint={formatEuro(pricing.wandeltochtNonMemberCents)}
            value={wandeltocht}
            onChange={setWandeltocht}
            disabled={busy}
          />
          <ItemStepper
            label="Wandeltocht (lid)"
            hint={formatEuro(pricing.wandeltochtMemberCents)}
            value={wandeltochtMember}
            onChange={setWandeltochtMember}
            disabled={busy}
          />
          <div className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="font-medium">Fooi</p>
              <p className="text-sm text-muted-foreground">Optioneel bedrag</p>
            </div>
            <Input
              type="number"
              min={0}
              step={0.5}
              value={fooiInput}
              onChange={(e) => setFooiInput(e.target.value)}
              className="w-24 text-center"
            />
          </div>

          {breakdown.length > 0 && (
            <div className="flex flex-col gap-1 border-t pt-3">
              {breakdown.map((line, i) => (
                <p key={i} className="text-sm text-muted-foreground">
                  {line}
                </p>
              ))}
            </div>
          )}

          <p className="pt-3 text-lg font-bold">Totaal: {formatEuro(total)}</p>

          <Button className="mt-3 w-full" disabled={busy} onClick={handleGenerate}>
            {GENERATE_LABELS[paymentMethod]}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

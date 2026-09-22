import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getAllSlots, slotLabel, startNewSlot } from '@/shared/slots'

const WORKER_URL = '/api/bancontact'

// NOTE: same org-specific catalogue caveat as kassa's OrderBuilder — the
// bonnen/fietstocht/wandeltocht fields are one org's item taxonomy, ported
// verbatim from arcanum-webapp's settings.ts, not genericized.
export function PricingPanel() {
  const [amountPerBon, setAmountPerBon] = useState('')
  const [fietstochtMember, setFietstochtMember] = useState('')
  const [fietstochtNonMember, setFietstochtNonMember] = useState('')
  const [wandeltochtMember, setWandeltochtMember] = useState('')
  const [wandeltochtNonMember, setWandeltochtNonMember] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [resettingSlot, setResettingSlot] = useState(false)
  const [currentSlotLabel, setCurrentSlotLabel] = useState('')

  function renderCurrentSlotLabel() {
    const slots = getAllSlots()
    setCurrentSlotLabel(`Actief tijdvak: ${slotLabel(slots[slots.length - 1], slots.length - 1)}`)
  }

  useEffect(() => {
    renderCurrentSlotLabel()
    fetch(`${WORKER_URL}/settings`)
      .then((res) => res.json())
      .then((data) => {
        setAmountPerBon((data.amountPerBonCents / 100).toFixed(2))
        setFietstochtMember((data.fietstochtMemberCents / 100).toFixed(2))
        setFietstochtNonMember((data.fietstochtNonMemberCents / 100).toFixed(2))
        setWandeltochtMember((data.wandeltochtMemberCents / 100).toFixed(2))
        setWandeltochtNonMember((data.wandeltochtNonMemberCents / 100).toFixed(2))
      })
      .catch(() => setMessage({ text: 'Kon huidige instelling niet laden.', isError: true }))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    const amounts = {
      amountPerBonCents: parseFloat(amountPerBon),
      fietstochtMemberCents: parseFloat(fietstochtMember),
      fietstochtNonMemberCents: parseFloat(fietstochtNonMember),
      wandeltochtMemberCents: parseFloat(wandeltochtMember),
      wandeltochtNonMemberCents: parseFloat(wandeltochtNonMember),
    }

    if (Object.values(amounts).some((euros) => !euros || euros <= 0)) {
      setMessage({ text: 'Voer voor elk bedrag een geldige waarde groter dan 0 in.', isError: true })
      return
    }
    if (!password) {
      setMessage({ text: 'Voer het wachtwoord in.', isError: true })
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`${WORKER_URL}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          amountPerBonCents: Math.round(amounts.amountPerBonCents * 100),
          fietstochtMemberCents: Math.round(amounts.fietstochtMemberCents * 100),
          fietstochtNonMemberCents: Math.round(amounts.fietstochtNonMemberCents * 100),
          wandeltochtMemberCents: Math.round(amounts.wandeltochtMemberCents * 100),
          wandeltochtNonMemberCents: Math.round(amounts.wandeltochtNonMemberCents * 100),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Opslaan mislukt')
      setMessage({ text: 'Instelling opgeslagen.', isError: false })
      setPassword('')
    } catch (err) {
      setMessage({ text: (err as Error).message, isError: true })
    } finally {
      setSaving(false)
    }
  }

  async function handleResetSlot() {
    setMessage(null)
    if (!password) {
      setMessage({ text: 'Voer het wachtwoord in.', isError: true })
      return
    }
    if (!confirm('Nieuw tijdvak starten? Bestaande transacties blijven bewaard onder het huidige tijdvak.')) return

    setResettingSlot(true)
    try {
      const res = await fetch(`${WORKER_URL}/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Onjuist wachtwoord')

      startNewSlot()
      renderCurrentSlotLabel()
      setMessage({ text: 'Nieuw tijdvak gestart.', isError: false })
      setPassword('')
    } catch (err) {
      setMessage({ text: (err as Error).message, isError: true })
    } finally {
      setResettingSlot(false)
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="amount-per-bon">Bedrag per bon (EUR)</Label>
        <Input id="amount-per-bon" type="number" min={0.01} step={0.01} value={amountPerBon} onChange={(e) => setAmountPerBon(e.target.value)} autoComplete="off" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="amount-fietstocht-member">Bedrag fietstocht - lid (EUR)</Label>
        <Input
          id="amount-fietstocht-member"
          type="number"
          min={0.01}
          step={0.01}
          value={fietstochtMember}
          onChange={(e) => setFietstochtMember(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="amount-fietstocht-nonmember">Bedrag fietstocht - niet-lid (EUR)</Label>
        <Input
          id="amount-fietstocht-nonmember"
          type="number"
          min={0.01}
          step={0.01}
          value={fietstochtNonMember}
          onChange={(e) => setFietstochtNonMember(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="amount-wandeltocht-member">Bedrag wandeltocht - lid (EUR)</Label>
        <Input
          id="amount-wandeltocht-member"
          type="number"
          min={0.01}
          step={0.01}
          value={wandeltochtMember}
          onChange={(e) => setWandeltochtMember(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="amount-wandeltocht-nonmember">Bedrag wandeltocht - niet-lid (EUR)</Label>
        <Input
          id="amount-wandeltocht-nonmember"
          type="number"
          min={0.01}
          step={0.01}
          value={wandeltochtNonMember}
          onChange={(e) => setWandeltochtNonMember(e.target.value)}
          autoComplete="off"
        />
      </div>

      {/* Hidden username so browsers pair the saved password with a fixed
          identifier instead of guessing an amount field is the username. */}
      <input type="text" name="username" autoComplete="username" value="instellingen" readOnly className="hidden" aria-hidden="true" tabIndex={-1} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Wachtwoord</Label>
        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </div>

      <Button type="submit" disabled={saving} className="w-fit">
        Opslaan
      </Button>

      {message && <p className={message.isError ? 'text-sm text-destructive' : 'text-sm text-green-600 dark:text-green-500'}>{message.text}</p>}

      <div className="flex flex-col gap-2 border-t pt-4">
        <p className="text-sm text-muted-foreground">{currentSlotLabel}</p>
        <Button type="button" variant="outline" className="w-fit" disabled={resettingSlot} onClick={handleResetSlot}>
          Nieuw tijdvak starten
        </Button>
      </div>
    </form>
  )
}

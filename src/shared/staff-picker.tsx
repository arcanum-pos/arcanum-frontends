import { useCallback, useEffect, useState } from 'react'
import { Delete, UserRound } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useMessages, type Messages } from './i18n'
import { chooseStaff, chosenStaff, listStaff, onStaffChange, setChosenStaff, type ChosenStaff, type StaffMember } from './staff'

const TEXTS: Messages<{
  who: string
  nobody: string
  chooseTitle: string
  chooseText: string
  chooseRequired: string
  nobodyOption: string
  none: string
  pinFor: (name: string) => string
  ok: string
  back: string
  loadError: string
}> = {
  nl: {
    who: 'Wie werkt er?',
    nobody: 'Niemand gekozen',
    chooseTitle: 'Wie werkt er?',
    chooseText: 'Tik op je naam. Wat je doet, staat dan op jouw naam.',
    chooseRequired: 'Kies je naam voor je verkoopt.',
    nobodyOption: 'Niemand',
    none: 'Er zijn nog geen medewerkers. Een beheerder voegt ze toe in de console (Medewerkers).',
    pinFor: (name) => `Pincode van ${name}`,
    ok: 'OK',
    back: 'Terug',
    loadError: 'De medewerkers konden niet geladen worden.',
  },
  fr: {
    who: 'Qui travaille ?',
    nobody: 'Personne choisi',
    chooseTitle: 'Qui travaille ?',
    chooseText: 'Touchez votre nom. Ce que vous faites est alors à votre nom.',
    chooseRequired: 'Choisissez votre nom avant de vendre.',
    nobodyOption: 'Personne',
    none: 'Il n’y a pas encore de personnel. Un administrateur l’ajoute dans la console (Personnel).',
    pinFor: (name) => `Code PIN de ${name}`,
    ok: 'OK',
    back: 'Retour',
    loadError: 'Le personnel n’a pas pu être chargé.',
  },
  en: {
    who: 'Who is working?',
    nobody: 'Nobody chosen',
    chooseTitle: 'Who is working?',
    chooseText: 'Tap your name. What you do is then recorded under your name.',
    chooseRequired: 'Choose your name before you sell.',
    nobodyOption: 'Nobody',
    none: 'There are no staff yet. An admin adds them in the console (Staff).',
    pinFor: (name) => `${name}’s PIN`,
    ok: 'OK',
    back: 'Back',
    loadError: 'The staff could not be loaded.',
  },
}

// The person chosen on this device, kept in step across components.
export function useChosenStaff(orgId: string | null | undefined): ChosenStaff | null {
  const [staff, setStaff] = useState(() => chosenStaff(orgId))
  useEffect(() => {
    setStaff(chosenStaff(orgId))
    return onStaffChange(() => setStaff(chosenStaff(orgId)))
  }, [orgId])
  return staff
}

// "Who's working": the chosen person in a header, a tap to switch. `open`
// and `onOpenChange` let a screen open it itself (a sale refused with
// staff_required); `required`: no "Niemand" (S2).
export function StaffButton({ orgId, required = false, open, onOpenChange, className }: { orgId: string; required?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void; className?: string }) {
  const t = useMessages(TEXTS)
  const staff = useChosenStaff(orgId)
  const [ownOpen, setOwnOpen] = useState(false)
  const isOpen = open ?? ownOpen
  const setOpen = onOpenChange ?? setOwnOpen
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex min-w-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ring-1',
          staff ? 'bg-card ring-foreground/10' : required ? 'bg-amber-500/15 text-amber-800 ring-amber-500/40 dark:text-amber-200' : 'text-muted-foreground ring-foreground/10',
          className
        )}
        aria-label={t.who}
        data-testid="staff-button"
      >
        <UserRound className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{staff ? staff.name : t.nobody}</span>
      </button>
      <StaffPickerDialog orgId={orgId} open={isOpen} onOpenChange={setOpen} required={required} />
    </>
  )
}

export function StaffPickerDialog({ orgId, open, onOpenChange, required }: { orgId: string; open: boolean; onOpenChange: (open: boolean) => void; required: boolean }) {
  const t = useMessages(TEXTS)
  const current = useChosenStaff(orgId)
  const [staff, setStaff] = useState<StaffMember[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pinFor, setPinFor] = useState<StaffMember | null>(null)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setPinFor(null)
    setPin('')
    setError(null)
    listStaff(orgId)
      .then((r) => setStaff(r.staff))
      .catch(() => setError(t.loadError))
  }, [open, orgId, t.loadError])

  const pick = useCallback(
    async (member: StaffMember, withPin?: string) => {
      if (member.hasPin && withPin === undefined) {
        setPinFor(member)
        setPin('')
        setError(null)
        return
      }
      setBusy(true)
      setError(null)
      try {
        await chooseStaff(orgId, member, withPin)
        onOpenChange(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        setPin('')
      } finally {
        setBusy(false)
      }
    },
    [orgId, onOpenChange]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="staff-picker">
        <DialogHeader>
          <DialogTitle>{pinFor ? t.pinFor(pinFor.name) : t.chooseTitle}</DialogTitle>
          {!pinFor && <DialogDescription>{required && !current ? t.chooseRequired : t.chooseText}</DialogDescription>}
        </DialogHeader>
        {pinFor ? (
          <PinPad
            pin={pin}
            setPin={setPin}
            busy={busy}
            onSubmit={() => pick(pinFor, pin)}
            onBack={() => {
              setPinFor(null)
              setError(null)
            }}
            t={t}
          />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(staff ?? []).map((member) => (
              <Button
                key={member.id}
                variant={current?.id === member.id ? 'default' : 'outline'}
                className="h-14 text-base"
                disabled={busy}
                onClick={() => pick(member)}
                data-testid="staff-option"
              >
                {member.name}
              </Button>
            ))}
            {!required && staff && staff.length > 0 && (
              <Button
                variant="ghost"
                className="h-14 text-base text-muted-foreground"
                onClick={() => {
                  setChosenStaff(null)
                  onOpenChange(false)
                }}
                data-testid="staff-nobody"
              >
                {t.nobodyOption}
              </Button>
            )}
            {staff && staff.length === 0 && <p className="col-span-full text-sm text-muted-foreground">{t.none}</p>}
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PinPad({ pin, setPin, busy, onSubmit, onBack, t }: { pin: string; setPin: (pin: string) => void; busy: boolean; onSubmit: () => void; onBack: () => void; t: (typeof TEXTS)['nl'] }) {
  const press = (digit: string) => pin.length < 6 && setPin(pin + digit)
  return (
    <div className="flex flex-col items-center gap-3">
      <input
        className="h-12 w-48 rounded-lg border bg-background text-center font-mono text-2xl tracking-[0.5em]"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        maxLength={6}
        value={pin}
        aria-label={t.pinFor('')}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
        onKeyDown={(e) => e.key === 'Enter' && pin.length >= 4 && onSubmit()}
        data-testid="staff-pin"
      />
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Button key={d} variant="outline" className="size-14 text-xl" onClick={() => press(d)}>
            {d}
          </Button>
        ))}
        <Button variant="ghost" className="size-14" onClick={() => setPin(pin.slice(0, -1))} aria-label="⌫">
          <Delete className="size-5" />
        </Button>
        <Button variant="outline" className="size-14 text-xl" onClick={() => press('0')}>
          0
        </Button>
        <Button className="size-14" disabled={busy || pin.length < 4} onClick={onSubmit} data-testid="staff-pin-ok">
          {t.ok}
        </Button>
      </div>
      <Button variant="ghost" size="sm" onClick={onBack}>
        {t.back}
      </Button>
    </div>
  )
}

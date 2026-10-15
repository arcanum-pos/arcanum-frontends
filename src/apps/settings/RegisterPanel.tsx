import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useMessages } from '@/shared/i18n'
import { getRegister, listRegisters, setRegister, type Register } from '@/shared/register'
import { SETTINGS_MESSAGES } from './messages'

// Which register (cash drawer) this kassa sells on — DOMAIN_MODEL.md
// decision 8. With one, it sells only while that drawer's shift is open
// ("Kassa openen") and does the kasopmaak; without, it sells as before.
export function RegisterPanel({ posOrgId, onChange }: { posOrgId: string; onChange?: () => void }) {
  const m = useMessages(SETTINGS_MESSAGES)
  const [registers, setRegisters] = useState<Register[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState(() => getRegister(posOrgId))

  useEffect(() => {
    listRegisters(posOrgId)
      .then((r) => setRegisters(r.registers.filter((x) => !x.archived)))
      .catch(() => setFailed(true))
  }, [posOrgId])

  function choose(register: Register | null) {
    setRegister(register ? { orgId: posOrgId, id: register.id, name: register.name } : null)
    setSelected(getRegister(posOrgId))
    onChange?.()
  }

  const status = failed ? m.registersFailed : !registers ? m.registersLoading : registers.length === 0 ? m.registersNone : selected ? m.activeIs(selected.name) : m.registerNone

  return (
    <div className="flex flex-col gap-2" data-testid="register-panel">
      <p className="text-sm text-muted-foreground">{status}</p>
      {registers && registers.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
            <span>{m.registerNoneOption}</span>
            <Button size="sm" variant={selected ? 'secondary' : 'outline'} disabled={!selected} onClick={() => choose(null)}>
              {selected ? m.choose : m.active}
            </Button>
          </div>
          {registers.map((register) => {
            const isSelected = selected?.id === register.id
            return (
              <div key={register.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <span>{register.name}</span>
                <Button
                  size="sm"
                  variant={isSelected ? 'outline' : 'secondary'}
                  disabled={isSelected}
                  aria-label={isSelected ? m.activeNamed(register.name) : m.chooseNamed(register.name)}
                  onClick={() => choose(register)}
                >
                  {isSelected ? m.active : m.choose}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

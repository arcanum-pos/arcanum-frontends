import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getCatalogSelection, setCatalogSelection, type CatalogSelection } from '@/shared/device'
import { useMessages } from '@/shared/i18n'
import { listCatalogs, type CatalogSummary } from '../kassa/catalog-api'
import { SETTINGS_MESSAGES } from './messages'

// Which catalog (menukaart) this kassa sells from. None chosen = the org's
// default, which follows the org when an admin changes it; choosing one
// pins this device to it (see shared/device.ts's getCatalogSelection).
export function CatalogPanel({ posOrgId }: { posOrgId: string }) {
  const m = useMessages(SETTINGS_MESSAGES)
  const [phase, setPhase] = useState<'loading' | 'failed' | 'ready'>('loading')
  const [catalogs, setCatalogs] = useState<CatalogSummary[]>([])
  const [selected, setSelected] = useState<CatalogSelection | null>(null)

  const apply = useCallback((list: CatalogSummary[]) => {
    const sel = getCatalogSelection()
    setCatalogs(list)
    setSelected(sel)
    setPhase('ready')
  }, [])

  const refresh = useCallback(() => {
    listCatalogs(posOrgId)
      .then(apply)
      .catch(() => setPhase('failed'))
  }, [posOrgId, apply])

  useEffect(() => {
    let cancelled = false
    listCatalogs(posOrgId)
      .then((list) => !cancelled && apply(list))
      .catch(() => !cancelled && setPhase('failed'))
    return () => {
      cancelled = true
    }
  }, [posOrgId, apply])

  function choose(selection: CatalogSelection | null) {
    setCatalogSelection(selection)
    refresh()
  }

  const defaultCatalog = catalogs.find((c) => c.isDefault)
  const status =
    phase === 'loading'
      ? m.catalogsLoading
      : phase === 'failed'
        ? m.catalogsFailed
        : catalogs.length === 0
          ? m.catalogsNone
          : selected
            ? m.activeIs(selected.name)
            : m.catalogOrgDefaultActive

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{status}</p>
      {catalogs.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
            <span>{m.catalogOrgDefault(defaultCatalog?.name ?? null)}</span>
            <Button size="sm" variant={selected ? 'secondary' : 'outline'} disabled={!selected} onClick={() => choose(null)}>
              {selected ? m.choose : m.active}
            </Button>
          </div>
          {catalogs.map((catalog) => {
            const isSelected = selected?.id === catalog.id
            return (
              <div key={catalog.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <span>{catalog.name}</span>
                <Button
                  size="sm"
                  variant={isSelected ? 'outline' : 'secondary'}
                  disabled={isSelected}
                  aria-label={isSelected ? m.activeNamed(catalog.name) : m.chooseNamed(catalog.name)}
                  onClick={() => choose({ id: catalog.id, name: catalog.name })}
                >
                  {isSelected ? m.active : m.choose}
                </Button>
              </div>
            )
          })}
        </div>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => {
          setPhase('loading')
          refresh()
        }}
      >
        {m.refresh}
      </Button>
    </div>
  )
}

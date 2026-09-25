import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { getCatalogSelection, setCatalogSelection, type CatalogSelection } from '@/shared/device'
import { listCatalogs, type CatalogSummary } from '../kassa/catalog-api'

// Which catalog (menukaart) this kassa sells from. None chosen = the org's
// default, which follows the org when an admin changes it; choosing one
// pins this device to it (see shared/device.ts's getCatalogSelection).
export function CatalogPanel({ posOrgId }: { posOrgId: string }) {
  const [status, setStatus] = useState('Menukaarten laden...')
  const [catalogs, setCatalogs] = useState<CatalogSummary[]>([])
  const [selected, setSelected] = useState<CatalogSelection | null>(null)

  const apply = useCallback((list: CatalogSummary[]) => {
    const sel = getCatalogSelection()
    setCatalogs(list)
    setSelected(sel)
    if (list.length === 0) setStatus('Nog geen menukaart — een beheerder maakt er een in de console.')
    else setStatus(sel ? `Actief: ${sel.name}` : 'Actief: standaardmenukaart van de organisatie.')
  }, [])

  const refresh = useCallback(() => {
    listCatalogs(posOrgId)
      .then(apply)
      .catch(() => setStatus('Kon menukaarten niet ophalen.'))
  }, [posOrgId, apply])

  useEffect(() => {
    let cancelled = false
    listCatalogs(posOrgId)
      .then((list) => !cancelled && apply(list))
      .catch(() => !cancelled && setStatus('Kon menukaarten niet ophalen.'))
    return () => {
      cancelled = true
    }
  }, [posOrgId, apply])

  function choose(selection: CatalogSelection | null) {
    setCatalogSelection(selection)
    refresh()
  }

  const defaultCatalog = catalogs.find((c) => c.isDefault)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{status}</p>
      {catalogs.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
            <span>Standaard van de organisatie{defaultCatalog ? ` (${defaultCatalog.name})` : ''}</span>
            <Button size="sm" variant={selected ? 'secondary' : 'outline'} disabled={!selected} onClick={() => choose(null)}>
              {selected ? 'Kies' : 'Actief'}
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
                  aria-label={isSelected ? `${catalog.name} actief` : `Kies ${catalog.name}`}
                  onClick={() => choose({ id: catalog.id, name: catalog.name })}
                >
                  {isSelected ? 'Actief' : 'Kies'}
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
          setStatus('Menukaarten laden...')
          refresh()
        }}
      >
        Vernieuwen
      </Button>
    </div>
  )
}

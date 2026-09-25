import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { exportCatalog } from '../lib/catalog-api'

// "Exporteren" → Excel (.xlsx, same layout as the import expects, plus an
// Uitleg sheet) or CSV (;-separated with decimal comma, for Belgian Excel).
// The spreadsheet code is only loaded when one of the two is clicked.
export function MenuExportButton({
  orgId,
  catalogId,
  variant = 'outline',
  size = 'default',
  onError,
}: {
  orgId: string
  catalogId: string
  variant?: 'outline' | 'ghost'
  size?: 'default' | 'sm'
  onError: (message: string) => void
}) {
  const [busy, setBusy] = useState(false)

  async function run(format: 'xlsx' | 'csv') {
    setBusy(true)
    try {
      const [data, files] = await Promise.all([exportCatalog(orgId, catalogId), import('../lib/menu-files')])
      await files.downloadMenu(data.catalog.name, data.rows, format)
    } catch (err) {
      onError(`Exporteren mislukt: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={busy}>
          <Download /> Exporteren
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => run('xlsx')}>Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run('csv')}>CSV (.csv)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

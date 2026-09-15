import { useState } from 'react'
import { Building2, ChevronsUpDown, Plus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOrg } from '../lib/org-context'

export function TeamSwitcher() {
  const { isMobile } = useSidebar()
  const { orgs, currentOrg, setCurrentOrgId, addOrg } = useOrg()
  const [createOpen, setCreateOpen] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')

  function handleCreate() {
    const name = newOrgName.trim()
    if (!name) return
    addOrg({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name })
    setNewOrgName('')
    setCreateOpen(false)
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Building2 className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{currentOrg.name}</span>
                  <span className="truncate text-xs text-muted-foreground">Organisatie</span>
                </div>
                <ChevronsUpDown className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              align="start"
              side={isMobile ? 'bottom' : 'right'}
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-xs text-muted-foreground">Organisaties</DropdownMenuLabel>
              {orgs.map((org) => (
                <DropdownMenuItem key={org.id} onClick={() => setCurrentOrgId(org.id)} className="gap-2 p-2">
                  <div className="flex size-6 items-center justify-center rounded-md border">
                    <Building2 className="size-3.5 shrink-0" />
                  </div>
                  {org.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 p-2" onClick={() => setCreateOpen(true)}>
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <Plus className="size-4" />
                </div>
                <div className="font-medium text-muted-foreground">Nieuwe organisatie</div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuwe organisatie aanmaken</DialogTitle>
            <DialogDescription>Je wordt automatisch beheerder (admin) van deze organisatie.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="new-org-name">Naam</Label>
            <Input
              id="new-org-name"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder="bv. Scouts Elewijt"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button onClick={handleCreate}>Aanmaken</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

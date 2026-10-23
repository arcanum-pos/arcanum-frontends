import { Fragment } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useMessages } from '@/shared/i18n'
import { ADMIN_SHELL_MESSAGES } from '../messages/shell'

export interface RowAction {
  label: string
  onSelect: () => void
  // Removes or deletes something: red, and last, under a line.
  destructive?: boolean
  disabled?: boolean
}

// The actions on a line in the console, everywhere the same (2026-10-24):
// one "…" button at the end of the line, the actions in its menu as words
// (no icons, no trash can), even when there's only one. `false`/`null`
// leaves an action out, so a caller can write `cond && { … }`. `name`: what
// the line is about, for the button's label ("Acties voor Zomerkaart").
export function RowActions({ name, actions, disabled }: { name: string; actions: (RowAction | false | null | undefined)[]; disabled?: boolean }) {
  const m = useMessages(ADMIN_SHELL_MESSAGES)
  const shown = actions.filter((a): a is RowAction => !!a)
  if (shown.length === 0) return null
  const plain = shown.filter((a) => !a.destructive)
  const destructive = shown.filter((a) => a.destructive)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" disabled={disabled} aria-label={m.rowActions(name)}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {plain.map((a) => (
          <DropdownMenuItem key={a.label} disabled={a.disabled} onSelect={a.onSelect}>
            {a.label}
          </DropdownMenuItem>
        ))}
        {destructive.map((a, i) => (
          <Fragment key={a.label}>
            {i === 0 && plain.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem variant="destructive" disabled={a.disabled} onSelect={a.onSelect}>
              {a.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

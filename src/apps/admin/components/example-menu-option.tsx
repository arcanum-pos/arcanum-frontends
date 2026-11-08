import { useMessages } from '@/shared/i18n'
import { ADMIN_SHELL_MESSAGES } from '../messages/shell'

// "Start met een voorbeeldmenu" when creating an organisation (on by
// default): the demo's menukaart, so the kassa can sell right away.
export function ExampleMenuOption({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const m = useMessages(ADMIN_SHELL_MESSAGES)
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-0.5 accent-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {m.exampleMenu}
        <span className="block text-muted-foreground">{m.exampleMenuHint}</span>
      </span>
    </label>
  )
}

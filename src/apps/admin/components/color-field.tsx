import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const HEX = /^#[0-9a-f]{6}$/i

// One colour: the browser's colour picker and the hex code beside it (typed
// or pasted, e.g. a club's official #c8102e), and a button to have none —
// `emptyLabel` says what applies then. `onChange` gets #rrggbb or null, once
// the code is complete.
export function ColorField({
  id,
  label,
  value,
  emptyLabel,
  clearLabel,
  disabled,
  onChange,
}: {
  id: string
  label: string
  value: string | null
  emptyLabel: string
  clearLabel: string
  disabled?: boolean
  onChange: (color: string | null) => void
}) {
  const [text, setText] = useState(value ?? '')
  useEffect(() => setText(value ?? ''), [value])
  const valid = text === '' || HEX.test(text)
  return (
    <div className="grid gap-1.5" data-testid={`color-${id}`}>
      <Label htmlFor={`${id}-hex`}>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={value ?? '#ffffff'}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-md border bg-transparent p-1 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Input
          id={`${id}-hex`}
          value={text}
          placeholder={emptyLabel}
          disabled={disabled}
          aria-invalid={!valid}
          className="w-36 font-mono"
          onChange={(e) => {
            const next = e.target.value.trim()
            setText(next)
            if (HEX.test(next)) onChange(next.toLowerCase())
          }}
        />
        {value && (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange(null)}>
            {clearLabel}
          </Button>
        )}
      </div>
      {!value && <p className="text-xs text-muted-foreground">{emptyLabel}</p>}
    </div>
  )
}

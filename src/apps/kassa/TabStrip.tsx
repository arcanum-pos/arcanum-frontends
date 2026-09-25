import { Button } from '@/components/ui/button'
import { formatEuro } from '@/shared/format'
import { tabTitle, type TabSummary } from './tabs-api'

// 'quick' is the permanent Toog button: not a server tab yet, just a draft
// — paying it creates a brand-new tab each time, so a paid tab is never
// reused (DOMAIN_MODEL.md). Everything else is a real open tab's id.
export type ActiveKey = 'quick' | string

export const QUICK_SALE_LABEL = 'Toog'

export function TabStrip({
  tabs,
  active,
  draftKeys,
  disabled,
  onSelect,
  onNew,
}: {
  tabs: TabSummary[]
  active: ActiveKey
  // Tabs with unsubmitted lines on this kassa — marked so they aren't forgotten.
  draftKeys: Set<string>
  disabled: boolean
  onSelect: (key: ActiveKey) => void
  onNew: () => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <Button
        variant={active === 'quick' ? 'default' : 'outline'}
        className="h-auto shrink-0 flex-col items-start gap-0 px-4 py-2"
        disabled={disabled}
        onClick={() => onSelect('quick')}
      >
        <span className="font-semibold">
          {QUICK_SALE_LABEL}
          {draftKeys.has('quick') && ' •'}
        </span>
        <span className="text-xs opacity-80">Direct afrekenen</span>
      </Button>

      {tabs.map((tab) => (
        <Button
          key={tab.id}
          variant={active === tab.id ? 'default' : 'outline'}
          className="h-auto shrink-0 flex-col items-start gap-0 px-4 py-2"
          disabled={disabled}
          onClick={() => onSelect(tab.id)}
        >
          <span className="font-semibold">
            {tabTitle(tab)}
            {draftKeys.has(tab.id) && ' •'}
          </span>
          <span className="text-xs opacity-80">{tab.paymentPending ? 'Betaling loopt…' : formatEuro(tab.outstandingCents)}</span>
        </Button>
      ))}

      <Button variant="secondary" className="h-auto shrink-0 px-4 py-2" disabled={disabled} onClick={onNew}>
        + Nieuwe rekening
      </Button>
    </div>
  )
}

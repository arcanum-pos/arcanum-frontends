import { cn } from 'cn'
import { formatEuro } from '@/shared/format'
import { tabTitle, type TabSummary } from './tabs-api'

// 'quick' is the permanent Toog button: not a server tab yet, just a draft
// — paying it creates a brand-new tab each time, so a paid tab is never
// reused (DOMAIN_MODEL.md). Everything else is a real open tab's id.
export type ActiveKey = 'quick' | string

export const QUICK_SALE_LABEL = 'Toog'

// One pill per open tab (design_files: name + amount, the active one dark).
function TabPill({ active, disabled, onClick, children }: { active: boolean; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-[13px] whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50',
        active ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground/80 hover:bg-muted'
      )}
    >
      {children}
    </button>
  )
}

export function TabStrip({
  tabs,
  active,
  draftKeys,
  quickTotalCents,
  disabled,
  onSelect,
  onNew,
}: {
  tabs: TabSummary[]
  active: ActiveKey
  // Tabs with unsubmitted lines on this kassa — marked so they aren't forgotten.
  draftKeys: Set<string>
  // What's on the Toog draft right now (0 = nothing yet).
  quickTotalCents: number
  disabled: boolean
  onSelect: (key: ActiveKey) => void
  onNew: () => void
}) {
  const amount = (isActive: boolean) => cn('font-mono text-xs tabular-nums', isActive ? 'text-background/70' : 'text-muted-foreground')
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
      <TabPill active={active === 'quick'} disabled={disabled} onClick={() => onSelect('quick')}>
        <span className="font-medium">
          {QUICK_SALE_LABEL}
          {draftKeys.has('quick') && ' •'}
        </span>
        <span className={quickTotalCents > 0 ? amount(active === 'quick') : cn('text-xs', active === 'quick' ? 'text-background/70' : 'text-muted-foreground')}>
          {quickTotalCents > 0 ? formatEuro(quickTotalCents) : 'Direct afrekenen'}
        </span>
      </TabPill>

      {tabs.map((tab) => (
        <TabPill key={tab.id} active={active === tab.id} disabled={disabled} onClick={() => onSelect(tab.id)}>
          <span className="font-medium">
            {tabTitle(tab)}
            {draftKeys.has(tab.id) && ' •'}
          </span>
          <span className={amount(active === tab.id)}>{tab.paymentPending ? 'Betaling loopt…' : formatEuro(tab.outstandingCents)}</span>
        </TabPill>
      ))}

      <button
        type="button"
        disabled={disabled}
        onClick={onNew}
        className="h-9 shrink-0 rounded-lg border border-dashed border-foreground/20 bg-card px-3 text-[13px] font-medium whitespace-nowrap text-foreground/75 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        + Nieuwe rekening
      </button>
    </div>
  )
}

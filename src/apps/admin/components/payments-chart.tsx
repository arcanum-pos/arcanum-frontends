import { useEffect, useRef, useState } from 'react'
import { niceTicks, type Bucket, type Step } from '../lib/report-buckets'

// Rapporten: one stacked bar per time slot, a segment per payment method —
// the number of payments, or their amount (two charts, never two scales in
// one). Colours per method are fixed (a filter never repaints them), from a
// validated palette (dataviz: blue, orange, aqua — safe for colour-blind
// readers, light and dark). The legend names them, hovering (or focusing)
// a bar shows its numbers; the payment list below is the table view.
export const METHOD_ORDER = ['bancontact', 'cash', 'sumup'] as const

const HEIGHT = 220
const GAP = 2
const PAD = { top: 12, right: 8, bottom: 26, left: 52 }

export function PaymentsChart({
  title,
  buckets,
  step,
  measure,
  methodLabel,
  totalLabel,
  format,
  intlLocale,
  testId,
}: {
  title: string
  buckets: Bucket[]
  step: Step
  measure: 'count' | 'amountCents'
  methodLabel: (method: string) => string
  totalLabel: string
  format: (value: number) => string
  intlLocale: string
  testId: string
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  const [hover, setHover] = useState<number | null>(null)
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Methods in their fixed order, then any other (shown as "other").
  const present = new Set(buckets.flatMap((b) => Object.keys(b.byMethod)))
  const methods = [...METHOD_ORDER.filter((m) => present.has(m)), ...[...present].filter((m) => !(METHOD_ORDER as readonly string[]).includes(m))]
  const total = (b: Bucket) => Object.values(b.byMethod).reduce((s, c) => s + c[measure], 0)
  const ticks = niceTicks(Math.max(0, ...buckets.map(total)))
  const top = ticks[ticks.length - 1]
  const plotW = width - PAD.left - PAD.right
  // Per hour the axis has a second line (the day).
  const height = HEIGHT + (step === 'hour' ? 14 : 0)
  const plotH = height - PAD.top - PAD.bottom
  const plotBottom = PAD.top + plotH
  const slot = plotW / Math.max(1, buckets.length)
  const barW = Math.max(2, Math.min(36, slot * 0.72))
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH
  // A label every so many slots, so they never run into each other.
  const every = Math.max(1, Math.ceil(48 / slot))
  const clock = (d: Date) => d.toLocaleTimeString(intlLocale, { hour: '2-digit', minute: '2-digit' })
  const day = (d: Date) => d.toLocaleDateString(intlLocale, { weekday: 'short', day: 'numeric', month: 'short' })
  // Per hour (several days): the day where a new one starts, else the hour.
  const timeLabel = (d: Date) =>
    step === 'quarter' ? clock(d) : step === 'hour' ? `${day(d)} ${clock(d)}` : d.toLocaleDateString(intlLocale, { day: 'numeric', month: 'short' })
  // On the axis per hour: the hour, and under the first one of each day its day.
  const axisLabels = buckets.flatMap((b, i) => (i % every === 0 ? [{ i, b }] : [])).map(({ i, b }, k, all) => ({
    i,
    text: step === 'hour' ? clock(b.start) : timeLabel(b.start),
    under: step === 'hour' && (k === 0 || all[k - 1].b.start.toDateString() !== b.start.toDateString()) ? day(b.start) : null,
  }))

  const shown = hover !== null ? buckets[hover] : null

  return (
    <figure className="payments-chart relative flex min-w-0 flex-col gap-2" data-testid={testId}>
      <style>{`
        .payments-chart { --series-bancontact: #2a78d6; --series-cash: #eb6834; --series-sumup: #1baf7a; --series-other: #8c8b86; }
        .dark .payments-chart { --series-bancontact: #3987e5; --series-cash: #d95926; --series-sumup: #199e70; --series-other: #8c8b86; }
      `}</style>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-medium">{title}</span>
        <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground" data-testid={`${testId}-legend`}>
          {methods.map((m) => (
            <span key={m} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: `var(--series-${(METHOD_ORDER as readonly string[]).includes(m) ? m : 'other'})` }} />
              {methodLabel(m)}
            </span>
          ))}
        </span>
      </figcaption>
      <div ref={wrap} className="relative w-full">
        <svg width={width} height={height} role="img" aria-label={title} className="block overflow-visible" onMouseLeave={() => setHover(null)}>
          {/* Recessive grid and its values. */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                {format(t)}
              </text>
            </g>
          ))}
          {buckets.map((b, i) => {
            const x = PAD.left + i * slot + (slot - barW) / 2
            let acc = 0
            const parts = methods.filter((m) => b.byMethod[m]?.[measure])
            return (
              <g key={i} data-testid={`${testId}-bar`} data-total={total(b)}>
                {/* The hit area: the whole slot, taller than the bar. */}
                <rect
                  x={PAD.left + i * slot}
                  y={PAD.top}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  tabIndex={total(b) ? 0 : -1}
                  aria-label={`${timeLabel(b.start)}: ${format(total(b))}`}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="outline-none"
                />
                {hover === i && <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={plotH} className="pointer-events-none fill-foreground/[0.04]" />}
                {parts.map((m, k) => {
                  const v = b.byMethod[m][measure]
                  const y0 = y(acc)
                  acc += v
                  const y1 = y(acc)
                  // The same 2px of surface under every segment but the
                  // lowest, so each gap between two segments is equal; the
                  // top one rounded.
                  const h = Math.max(1, y0 - y1 - (k > 0 ? GAP : 0))
                  const isTop = k === parts.length - 1
                  const color = `var(--series-${(METHOD_ORDER as readonly string[]).includes(m) ? m : 'other'})`
                  return isTop ? (
                    <path key={m} className="pointer-events-none" fill={color} d={roundedTop(x, y1, barW, h, Math.min(4, barW / 2, h))} />
                  ) : (
                    <rect key={m} className="pointer-events-none" x={x} y={y1} width={barW} height={h} fill={color} />
                  )
                })}
              </g>
            )
          })}
          <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} className="stroke-foreground/30" strokeWidth={1} />
          {axisLabels.map(({ i, text, under }) => (
            <text key={i} x={PAD.left + i * slot + slot / 2} y={plotBottom + 18} textAnchor="middle" className="fill-muted-foreground text-[11px]">
              {text}
              {under && (
                <tspan x={PAD.left + i * slot + slot / 2} dy="1.3em" className="font-medium">
                  {under}
                </tspan>
              )}
            </text>
          ))}
        </svg>
        {shown && hover !== null && total(shown) > 0 && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 min-w-40 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
            style={{ left: Math.min(width - 170, Math.max(0, PAD.left + hover * slot + slot / 2 - 80)), top: 0 }}
            data-testid={`${testId}-tooltip`}
          >
            <p className="mb-1 font-medium">
              {timeLabel(shown.start)}
              {step !== 'day' && ` - ${clock(shown.end)}`}
            </p>
            {methods
              .filter((m) => shown.byMethod[m]?.[measure])
              .map((m) => (
                <p key={m} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-2 rounded-sm" style={{ background: `var(--series-${(METHOD_ORDER as readonly string[]).includes(m) ? m : 'other'})` }} />
                    {methodLabel(m)}
                  </span>
                  <span className="font-mono tabular-nums">{format(shown.byMethod[m][measure])}</span>
                </p>
              ))}
            <p className="mt-1 flex justify-between gap-4 border-t pt-1 font-medium">
              <span>{totalLabel}</span>
              <span className="font-mono tabular-nums">{format(total(shown))}</span>
            </p>
          </div>
        )}
      </div>
    </figure>
  )
}

function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

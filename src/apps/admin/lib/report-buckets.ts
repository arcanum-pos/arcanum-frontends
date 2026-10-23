// Rapporten's charts: the payments of the period (already narrowed to one
// event, when chosen) per time slot and per payment method — how many, and
// how much. A single day in slots of 15 minutes, trimmed to the hours that
// had payments; a week, a month or any longer period per (local) day.

export interface ChartPayment {
  completedAt: string
  method: string
  amountCents: number
}

export interface Bucket {
  start: Date
  end: Date
  byMethod: Record<string, { count: number; amountCents: number }>
}

export type Step = 'quarter' | 'day'

const QUARTER = 15 * 60_000
const DAY_MS = 86_400_000

// A day (or a little more, a clock change) in quarters; anything longer per day.
export function stepFor(from: Date, to: Date): Step {
  return to.getTime() - from.getTime() <= DAY_MS + 3_600_000 ? 'quarter' : 'day'
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

export function bucketize(payments: ChartPayment[], from: Date, to: Date, step = stepFor(from, to)): Bucket[] {
  const inRange = payments.filter((p) => {
    const t = Date.parse(p.completedAt)
    return t >= from.getTime() && t < to.getTime()
  })
  const buckets: Bucket[] = []
  if (step === 'day') {
    for (let d = startOfDay(from); d < to; d = addDays(d, 1)) buckets.push({ start: d, end: addDays(d, 1), byMethod: {} })
  } else {
    if (inRange.length === 0) return []
    // From the hour of the first payment to the end of the hour of the last.
    const times = inRange.map((p) => Date.parse(p.completedAt))
    const first = new Date(Math.min(...times))
    const last = new Date(Math.max(...times))
    const start = new Date(first.getFullYear(), first.getMonth(), first.getDate(), first.getHours())
    const end = new Date(last.getFullYear(), last.getMonth(), last.getDate(), last.getHours() + 1)
    for (let t = start.getTime(); t < end.getTime(); t += QUARTER) buckets.push({ start: new Date(t), end: new Date(t + QUARTER), byMethod: {} })
  }
  for (const p of inRange) {
    const t = Date.parse(p.completedAt)
    const bucket = buckets.find((b) => t >= b.start.getTime() && t < b.end.getTime())
    if (!bucket) continue
    const cell = (bucket.byMethod[p.method] ??= { count: 0, amountCents: 0 })
    cell.count += 1
    cell.amountCents += p.amountCents
  }
  return buckets
}

// A round top for the y axis and the ticks up to it (0 included): 1, 2 or 5 × 10^n steps.
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1]
  const raw = max / count
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((f) => f * magnitude).find((s) => s >= raw)!
  const ticks: number[] = []
  for (let v = 0; v < max + step; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  return ticks
}

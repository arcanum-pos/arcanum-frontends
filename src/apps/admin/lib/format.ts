// A discount (a negative price) reads "-€ 1,50".
export function formatEuro(cents: number): string {
  return `${cents < 0 ? '-' : ''}€ ${(Math.abs(cents) / 100).toFixed(2).replace('.', ',')}`
}

function formatDay(iso: string, intlLocale: string): string {
  return new Date(iso).toLocaleDateString(intlLocale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// An event's days: one, or the first to the last.
export function formatEventDays(event: { date: string; endDate?: string }, intlLocale: string): string {
  const first = formatDay(event.date, intlLocale)
  return event.endDate && event.endDate !== event.date ? `${first} – ${formatDay(event.endDate, intlLocale)}` : first
}

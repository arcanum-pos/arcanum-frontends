// The station screen's texts — the source of truth; fr.ts and en.ts must
// match this shape (see src/shared/i18n).
const nl = {
  title: 'Stationscherm',
  loading: 'Laden…',
  noStation: 'Dit scherm is aan geen station gekoppeld. Kies er een in de console (Toestellen).',
  loadError: (error: string) => `Kon de bonnen niet laden: ${error}`,
  onlyPaid: 'Alleen betaald',
  showDelivered: 'Toon afgeleverd',
  columns: { ordered: 'Besteld', in_progress: 'In bereiding', ready: 'Klaar', delivered: 'Afgeleverd' },
  empty: 'Niets',
  next: { ordered: 'Start', in_progress: 'Klaar', ready: 'Afgeleverd' } as Record<string, string>,
  back: 'Terug',
  unpaid: 'Nog niet betaald',
  onTab: 'Op rekening',
  selfOrder: 'Zelfbestelling',
  ago: (minutes: number) => (minutes < 1 ? 'net besteld' : `${minutes} min geleden`),
  voided: (count: number) => `${count} geannuleerd`,
  hiddenUnpaid: (count: number) => (count === 1 ? '1 onbetaalde bestelling verborgen' : `${count} onbetaalde bestellingen verborgen`),
}

export type StationMessages = typeof nl
export default nl

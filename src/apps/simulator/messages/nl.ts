// The SumUp simulator's texts — the source of truth; fr.ts and en.ts must
// match this shape (see src/shared/i18n).
const nl = {
  title: 'SumUp-simulator',
  waiting: 'Wacht op betaalverzoek',
  paid: 'Betaald',
  pending: 'In afwachting',
  confirmPaid: 'Betaald',
  simId: (id: string) => `SIM-ID: ${id}`,
  linked: (id: string, pos: string) => `SIM-ID: ${id} — gekoppeld aan kassa ${pos}`,
  unlinked: (id: string) => `SIM-ID: ${id} — niet gekoppeld aan een kassa`,
}

export type SimulatorMessages = typeof nl
export default nl

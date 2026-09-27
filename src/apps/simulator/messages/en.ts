import type { SimulatorMessages } from './nl'

export default {
  title: 'SumUp simulator',
  waiting: 'Waiting for a payment request',
  paid: 'Paid',
  pending: 'Pending',
  confirmPaid: 'Paid',
  simId: (id: string) => `SIM ID: ${id}`,
  linked: (id: string, pos: string) => `SIM ID: ${id} — linked to till ${pos}`,
  unlinked: (id: string) => `SIM ID: ${id} — not linked to a till`,
} satisfies SimulatorMessages

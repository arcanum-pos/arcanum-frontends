import type { SimulatorMessages } from './nl'

export default {
  title: 'Simulateur SumUp',
  waiting: 'En attente d’une demande de paiement',
  paid: 'Payé',
  pending: 'En attente',
  confirmPaid: 'Payé',
  simId: (id: string) => `ID SIM : ${id}`,
  linked: (id: string, pos: string) => `ID SIM : ${id} — lié à la caisse ${pos}`,
  unlinked: (id: string) => `ID SIM : ${id} — lié à aucune caisse`,
} satisfies SimulatorMessages

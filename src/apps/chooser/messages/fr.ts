import type { ChooserMessages } from './nl'

export default {
  whichOrg: 'Pour quelle organisation est cet appareil ?',
  whichRole: 'Qu’est-ce que cet appareil ?',
  org: (name: string) => `Organisation : ${name}`,
  roles: {
    pos: { title: 'Caisse', hint: 'Vendre des bons et créer des paiements' },
    cfd: { title: 'Écran client', hint: 'Affiche les codes QR et le statut du paiement au client' },
  },
} satisfies ChooserMessages

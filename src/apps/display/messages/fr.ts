import type { DisplayMessages } from './nl'

export default {
  idle: 'Prêt pour la prochaine commande',
  fullscreen: 'Plein écran',
  loadingStatus: 'chargement du statut...',
  linkedTo: (posId: string) => `lié à la caisse ${posId}`,
  notLinked: 'lié à aucune caisse',

  yourOrder: 'Votre commande',
  yourShare: 'Votre part',
  alreadyPaid: 'Déjà payé',
  tip: 'Pourboire',
  totalDue: 'Total à payer',
  partDue: (index: number, of: number) => `À payer · partie ${index} sur ${of}`,
  stillOpen: (amount: string) => `Reste à payer sur l’addition : ${amount}`,
  items: (count: number) => (count === 1 ? '1 article' : `${count} articles`),
  qrAlt: 'Code QR pour le paiement',
  waiting: 'En attente de votre paiement',
  failed: (status: string) => `Paiement : ${status.toLowerCase()} — adressez-vous au comptoir`,
  failedFallback: 'Échoué',
  expiresIn: (seconds: number) => `Expire dans ${seconds} s`,
  expired: 'Expiré',

  methods: { bancontact: 'Bancontact', cash: 'Espèces', sumup: 'SumUp' },
  payWith: {
    cash: 'Veuillez payer en espèces',
    sumup: 'Veuillez payer via SumUp',
    bancontact: 'Veuillez payer via Bancontact',
  },
  instructions: {
    bancontact: 'Ouvrez votre app bancaire, scannez le code et confirmez. L’écran passe automatiquement à la suite.',
    cash: 'Payez au comptoir — l’écran continue dès que la réception est confirmée.',
    sumup: 'Payez par carte ou smartphone sur le terminal de paiement.',
  },

  thanks: 'Merci !',
  paid: (amount: string, method: string) => `${amount} payé · ${method}`,
  part: (index: number, of: number) => `Partie ${index} sur ${of}`,
} satisfies DisplayMessages

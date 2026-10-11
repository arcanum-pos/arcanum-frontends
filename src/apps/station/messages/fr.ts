import type { StationMessages } from './nl'

const fr: StationMessages = {
  title: 'Écran de poste',
  loading: 'Chargement…',
  noStation: 'Cet écran n’est lié à aucun poste. Choisissez-en un dans la console (Appareils).',
  loadError: (error: string) => `Impossible de charger les bons : ${error}`,
  onlyPaid: 'Uniquement payées',
  showDelivered: 'Afficher les remises',
  columns: { ordered: 'Commandé', in_progress: 'En préparation', ready: 'Prêt', delivered: 'Remis' },
  empty: 'Rien',
  next: { ordered: 'Commencer', in_progress: 'Prêt', ready: 'Remis' },
  back: 'Retour',
  unpaid: 'Pas encore payée',
  onTab: 'Sur la note',
  selfOrder: 'Commande en ligne',
  ago: (minutes: number) => (minutes < 1 ? 'à l’instant' : `il y a ${minutes} min`),
  voided: (count: number) => `${count} annulé(s)`,
  hiddenUnpaid: (count: number) => (count === 1 ? '1 commande non payée masquée' : `${count} commandes non payées masquées`),
}

export default fr

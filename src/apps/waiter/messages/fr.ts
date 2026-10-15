import type { WaiterMessages } from './nl'

const fr: WaiterMessages = {
  loading: 'Chargement…',
  noAccess: 'Vous n’avez pas accès au service en salle. Demandez à un administrateur de vous inviter (rôle Service).',
  noEvent: 'Aucun événement avec un mode de commande « à table ». Un administrateur le configure dans l’événement (Modes de commande).',
  chooseOrg: 'Quelle organisation ?',
  chooseEvent: 'Quel événement ?',
  tables: 'Tables',
  noTables: 'Pas encore de tables. Un administrateur les crée dans la console (Tables).',
  states: { free: 'Libre', occupied: 'Occupée', clearing: 'À débarrasser' },
  back: 'Retour',
  table: (name) => `Table ${name}`,
  seat: 'Installer des clients',
  cleared: 'Débarrassée',
  order: 'Commander',
  pay: 'Encaisser',
  nothingYet: 'Rien de commandé.',
  toPay: 'À payer',
  less: (name) => `Un ${name} de moins`,
  more: (name) => `Un ${name} de plus`,
  send: (total) => `Envoyer · ${total}`,
  paid: 'Payé',
  bancontact: 'Bancontact (QR sur cet écran)',
  scanBancontact: 'Faites scanner ce code par le client avec l’app Bancontact.',
  sumup: (reader) => `SumUp · ${reader}`,
  onReader: (reader) => `Le montant est sur ${reader}. Faites payer le client.`,
  cashAtTill: (label) => `En espèces ? Les clients paient à la caisse : addition « ${label} ».`,
}

export default fr

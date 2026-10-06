import type { ChooserMessages } from './nl'

const fr: ChooserMessages = {
  title: 'Que voulez-vous faire ?',
  pairTitle: 'Coupler cet appareil',
  pairHint: 'Comme caisse ou écran client, avec un code de couplage. Un administrateur le crée dans la console sous Appareils → Ajouter un appareil.',
  code: 'Code de couplage',
  pair: 'Coupler',
  busy: 'En cours…',
  manageTitle: 'Gestion',
  manageHint: 'La console : cartes, appareils, utilisateurs et rapports.',
  manage: 'Vers la console',
  removed: 'Cet appareil n’est plus couplé (il a été supprimé dans la console). Couplez-le à nouveau avec un nouveau code.',
  pairedTitle: (name: string) => `Cet appareil est ${name}`,
  org: (name: string) => `Organisation : ${name}`,
  open: 'Ouvrir',
  roles: { pos: 'une caisse', cfd: 'un écran client' },
}

export default fr

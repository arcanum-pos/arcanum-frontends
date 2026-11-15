import type { AdminBackupMessages } from './nl'

export default {
  title: 'Sauvegarde',
  subtitle: 'Une installation locale envoie toutes ses données à une installation dans le cloud. Si l’appareil tombe en panne, vous continuez sur le cloud.',
  busy: 'En cours...',

  linkTitle: 'Sauvegarde dans le cloud',
  linkText: 'Créez un code de liaison sur l’installation cloud (Paramètres → Sauvegarde → Créer un code de liaison) et collez-le ici. Ensuite, chaque modification part toute seule vers le cloud, même après un moment sans internet.',
  codeLabel: 'Code de liaison',
  codePlaceholder: 'arcanum-backup:...',
  link: 'Lier',

  linkedTo: (url: string) => `Lié à ${url}`,
  lastSync: 'Dernière mise à jour',
  never: 'jamais',
  pending: 'Modifications en attente',
  pendingNone: 'aucune - le cloud est à jour',
  firstSync: 'Premier transfert',
  firstSyncLeft: (n: number) => `encore ${n} lignes`,
  firstSyncDone: 'terminé',
  lastError: 'Dernière erreur',
  errors: {
    unreachable: 'Le cloud est injoignable (pas d’internet ?). Les modifications attendent et partiront dès que possible.',
    sync_cloud_daily_limit: 'Le cloud a atteint sa limite quotidienne. Le transfert reprend demain (UTC).',
    sync_version_mismatch: 'Le cloud tourne sur une autre version. Mettez les deux à jour vers la même version.',
    sync_foreign_ids: 'Le cloud refuse ces données (elles appartiennent à une autre organisation là-bas). Contactez l’administrateur.',
    sync_key_refused: 'Le cloud ne connaît plus cette sauvegarde : elle y a été supprimée ou mise en service. Déliez ici, puis liez de nouveau avec un nouveau code de liaison si vous voulez encore une sauvegarde.',
  } as Record<string, string>,
  versions: (protocol: number, schema: string) => `Protocole ${protocol}, schéma ${schema}`,
  unlink: 'Délier',
  unlinkConfirm: 'Ne plus rien envoyer au cloud ? La copie là-bas est conservée.',

  replicaTitle: 'Ceci est une sauvegarde',
  replicaText: 'Cette organisation est tenue à jour par une installation locale. Ici, vous pouvez tout consulter, mais rien modifier.',
  lastHeard: 'Dernière mise à jour par l’appareil local',

  inviteTitle: 'Recevoir une sauvegarde',
  inviteText: 'Créez un code de liaison et collez-le sur l’installation locale. L’organisation apparaît ici au premier transfert, en lecture seule.',
  inviteCreate: 'Créer un code de liaison',
  inviteShownOnce: (until: string) => `Ne montrez ce code à personne d’autre. Il n’est affiché qu’une fois ; valable jusqu’au ${until}.`,
  copy: 'Copier',
  copied: 'Copié',

  promote: 'Mettre en service',
  promoteTitle: 'Mettre la sauvegarde en service',
  promoteText: (org: string) => `Uniquement si l’appareil local est en panne. Ensuite, vous continuez ici : tout peut à nouveau être modifié, et l’ancien appareil ne peut plus rien envoyer. Faites pointer l’adresse de la caisse (DNS) vers cette installation. Tapez ${org} pour confirmer.`,
  promoteLabel: 'Nom de l’organisation',

  bannerTitle: 'Sauvegarde - lecture seule',
  bannerText: 'Les modifications se font uniquement sur l’installation locale.',

  ago: {
    now: 'à l’instant',
    minutes: (n: number) => (n === 1 ? 'il y a 1 minute' : `il y a ${n} minutes`),
    hours: (n: number) => (n === 1 ? 'il y a 1 heure' : `il y a ${n} heures`),
    days: (n: number) => (n === 1 ? 'il y a 1 jour' : `il y a ${n} jours`),
  },
} satisfies AdminBackupMessages

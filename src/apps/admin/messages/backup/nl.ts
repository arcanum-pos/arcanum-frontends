// Settings → Reservekopie (OFFLINE.md): a local installation sends its
// organisation to a cloud installation as a backup. The source of truth;
// fr.ts and en.ts must match this shape.
const nl = {
  title: 'Reservekopie',
  subtitle: 'Een lokale installatie stuurt al haar gegevens naar een cloudinstallatie. Gaat het toestel stuk, dan werk je verder op de cloud.',
  busy: 'Bezig...',

  // On the box: link to a backup
  linkTitle: 'Reservekopie in de cloud',
  linkText: 'Maak op de cloudinstallatie een koppelcode (Instellingen → Reservekopie → Koppelcode maken) en plak ze hier. Daarna gaat elke wijziging vanzelf naar de cloud, ook na een tijd zonder internet.',
  codeLabel: 'Koppelcode',
  codePlaceholder: 'arcanum-backup:...',
  link: 'Koppelen',

  // On the box: status
  linkedTo: (url: string) => `Gekoppeld aan ${url}`,
  lastSync: 'Laatst bijgewerkt',
  never: 'nog nooit',
  pending: 'Wijzigingen in de wachtrij',
  pendingNone: 'geen - de cloud is bij',
  firstSync: 'Eerste overzetting',
  firstSyncLeft: (n: number) => `nog ${n} rijen te gaan`,
  firstSyncDone: 'klaar',
  lastError: 'Laatste fout',
  errors: {
    unreachable: 'De cloud is niet bereikbaar (geen internet?). De wijzigingen wachten en gaan vanzelf mee zodra het weer kan.',
    sync_cloud_daily_limit: 'De cloud heeft haar dagelijkse limiet bereikt. Morgen (UTC) gaat het verder.',
    sync_version_mismatch: 'De cloud draait een andere versie. Werk beide bij naar dezelfde versie.',
    sync_foreign_ids: 'De cloud weigert deze gegevens (ze horen bij een andere organisatie daar). Neem contact op met de beheerder.',
  } as Record<string, string>,
  versions: (protocol: number, schema: string) => `Protocol ${protocol}, schema ${schema}`,
  unlink: 'Ontkoppelen',
  unlinkConfirm: 'Niets meer naar de cloud sturen? De kopie daar blijft bestaan.',

  // On the cloud: this org is a backup
  replicaTitle: 'Dit is een reservekopie',
  replicaText: 'Deze organisatie wordt bijgehouden door een lokale installatie. Hier kun je alles bekijken, maar niets wijzigen.',
  lastHeard: 'Laatst bijgewerkt door het lokale toestel',

  // On the cloud: make a link code
  inviteTitle: 'Een reservekopie ontvangen',
  inviteText: 'Maak een koppelcode en plak ze op de lokale installatie. De organisatie verschijnt hier bij de eerste overzetting, alleen-lezen.',
  inviteCreate: 'Koppelcode maken',
  inviteShownOnce: (until: string) => `Toon deze code aan niemand anders. Je ziet ze maar één keer; ze is geldig tot ${until}.`,
  copy: 'Kopiëren',
  copied: 'Gekopieerd',

  // The banner on every page of a backup
  bannerTitle: 'Reservekopie - alleen lezen',
  bannerText: 'Wijzigen kan alleen op de lokale installatie.',

  ago: {
    now: 'net nu',
    minutes: (n: number) => (n === 1 ? '1 minuut geleden' : `${n} minuten geleden`),
    hours: (n: number) => (n === 1 ? '1 uur geleden' : `${n} uur geleden`),
    days: (n: number) => (n === 1 ? '1 dag geleden' : `${n} dagen geleden`),
  },
}

export type AdminBackupMessages = typeof nl
export default nl

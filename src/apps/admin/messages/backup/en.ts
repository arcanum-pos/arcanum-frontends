import type { AdminBackupMessages } from './nl'

export default {
  title: 'Backup',
  subtitle: 'A local installation sends all its data to a cloud installation. If the device breaks, you carry on in the cloud.',
  busy: 'Working...',

  linkTitle: 'Backup in the cloud',
  linkText: 'Make a link code on the cloud installation (Settings → Backup → Make a link code) and paste it here. From then on every change goes to the cloud by itself, also after a while without internet.',
  codeLabel: 'Link code',
  codePlaceholder: 'arcanum-backup:...',
  link: 'Link',

  linkedTo: (url: string) => `Linked to ${url}`,
  lastSync: 'Last updated',
  never: 'never',
  pending: 'Changes waiting',
  pendingNone: 'none - the cloud is up to date',
  firstSync: 'First transfer',
  firstSyncLeft: (n: number) => `${n} rows to go`,
  firstSyncDone: 'done',
  lastError: 'Last error',
  errors: {
    unreachable: 'The cloud cannot be reached (no internet?). The changes wait and go along as soon as it can.',
    sync_cloud_daily_limit: 'The cloud reached its daily limit. It carries on tomorrow (UTC).',
    sync_version_mismatch: 'The cloud runs another version. Update both to the same version.',
    sync_foreign_ids: 'The cloud refuses this data (it belongs to another organisation there). Contact the administrator.',
  } as Record<string, string>,
  versions: (protocol: number, schema: string) => `Protocol ${protocol}, schema ${schema}`,
  unlink: 'Unlink',
  unlinkConfirm: 'Stop sending to the cloud? The copy there stays.',

  replicaTitle: 'This is a backup',
  replicaText: 'This organisation is kept up to date by a local installation. You can look at everything here, but change nothing.',
  lastHeard: 'Last updated by the local device',

  inviteTitle: 'Receive a backup',
  inviteText: 'Make a link code and paste it on the local installation. The organisation appears here with the first transfer, read-only.',
  inviteCreate: 'Make a link code',
  inviteShownOnce: (until: string) => `Show this code to no one else. You only see it once; it is valid until ${until}.`,
  copy: 'Copy',
  copied: 'Copied',

  bannerTitle: 'Backup - read-only',
  bannerText: 'Changes can only be made on the local installation.',

  ago: {
    now: 'just now',
    minutes: (n: number) => (n === 1 ? '1 minute ago' : `${n} minutes ago`),
    hours: (n: number) => (n === 1 ? '1 hour ago' : `${n} hours ago`),
    days: (n: number) => (n === 1 ? '1 day ago' : `${n} days ago`),
  },
} satisfies AdminBackupMessages

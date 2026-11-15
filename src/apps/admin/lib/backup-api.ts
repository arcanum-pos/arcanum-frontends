// arcanum-backend's sync/push.ts and sync/replica.ts (OFFLINE.md): an org's
// backup on a cloud installation.
import { request } from './api'

export interface BackupStatus {
  role: 'none' | 'source' | 'replica'
  remoteUrl?: string
  linkedAt?: string
  lastSyncAt?: string | null
  lastError?: string | null
  pending?: number
  pendingFirstSync?: number
  oldestPendingAt?: string | null
  firstSyncDoneAt?: string | null
  protocol: number
  schema: string
}

export const getBackupStatus = (orgId: string) => request<BackupStatus>(`/${orgId}/backup`)

export const linkBackup = (orgId: string, code: string) =>
  request<BackupStatus>(`/${orgId}/backup`, { method: 'POST', body: JSON.stringify({ code: code.trim() }) })

export const unlinkBackup = (orgId: string) => request<BackupStatus>(`/${orgId}/backup`, { method: 'DELETE' })

export const promoteBackup = (orgId: string, confirm: string) =>
  request<BackupStatus>(`/${orgId}/backup/promote`, { method: 'POST', body: JSON.stringify({ confirm }) })

export const createBackupInvite = () => request<{ code: string; expiresAt: string }>('/backups', { method: 'POST' })

// The kind of a recorded sync error, for its explanation: the box records
// 'unreachable: <details>' or the cloud's code.
export function errorKind(error: string): string {
  return error.startsWith('unreachable') ? 'unreachable' : error.split(':')[0].trim()
}

// How long ago, in the largest whole unit: [unit, n].
export function agoParts(iso: string, now = Date.now()): ['now' | 'minutes' | 'hours' | 'days', number] {
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000)
  if (minutes < 1) return ['now', 0]
  if (minutes < 60) return ['minutes', minutes]
  if (minutes < 48 * 60) return ['hours', Math.floor(minutes / 60)]
  return ['days', Math.floor(minutes / 1440)]
}

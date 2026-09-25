import { useEffect, useState } from 'react'

// Arcanum is AGPL-3.0-or-later: an installation must offer its users the
// source of what it runs (§13). arcanum-bff's public /version tells where
// (its SOURCE_URL setting, so a modified installation can point to its own
// fork); until that answers — or if it can't — the upstream repos.
// /version also says whether the installation has arcanum-installer behind
// it at /installer/ (self-hosted installations only) — the console links it —
// and which release runs (the console footer shows it).
export const DEFAULT_SOURCE_URL = 'https://github.com/arcanum-pos'

export interface VersionInfo {
  sourceUrl: string
  installer: boolean
  // The installed release ("0.1.4"); null = deployed straight from the repos
  // (main); undefined = unknown (/version didn't answer).
  release?: string | null
}

const DEFAULT_INFO: VersionInfo = { sourceUrl: DEFAULT_SOURCE_URL, installer: false }

export function pickSourceUrl(body: unknown): string {
  const url = (body as { source_url?: unknown } | null)?.source_url
  return typeof url === 'string' && /^https?:\/\//.test(url) ? url : DEFAULT_SOURCE_URL
}

export function pickRelease(body: unknown): string | null | undefined {
  if (!body || typeof body !== 'object') return undefined
  const release = (body as { release?: unknown }).release
  return typeof release === 'string' && /^[0-9A-Za-z.+-]{1,40}$/.test(release) ? release : null
}

export function pickVersionInfo(body: unknown): VersionInfo {
  return { sourceUrl: pickSourceUrl(body), installer: (body as { installer?: unknown } | null)?.installer === true, release: pickRelease(body) }
}

// What the footer shows: "Arcanum 0.1.4", "Arcanum main", or nothing yet.
export function versionLabel(info: VersionInfo): string | null {
  if (info.release === undefined) return null
  return `Arcanum ${info.release ?? 'main'}`
}

// One /version request per page load, however many components ask.
let pending: Promise<VersionInfo> | null = null
function loadVersionInfo(): Promise<VersionInfo> {
  pending ??= fetch('/version')
    .then((res) => (res.ok ? res.json() : null))
    .then(pickVersionInfo)
    .catch(() => DEFAULT_INFO)
  return pending
}

export function useVersionInfo(): VersionInfo {
  const [info, setInfo] = useState(DEFAULT_INFO)
  useEffect(() => {
    let cancelled = false
    loadVersionInfo().then((v) => !cancelled && setInfo(v))
    return () => {
      cancelled = true
    }
  }, [])
  return info
}

export function useSourceUrl(): string {
  return useVersionInfo().sourceUrl
}

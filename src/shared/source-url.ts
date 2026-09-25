import { useEffect, useState } from 'react'

// Arcanum is AGPL-3.0-or-later: an installation must offer its users the
// source of what it runs (§13). arcanum-bff's public /version tells where
// (its SOURCE_URL setting, so a modified installation can point to its own
// fork); until that answers — or if it can't — the upstream repos.
// /version also says whether the installation has arcanum-installer behind
// it at /installer/ (self-hosted installations only) — the console links it.
export const DEFAULT_SOURCE_URL = 'https://github.com/arcanum-pos'

export interface VersionInfo {
  sourceUrl: string
  installer: boolean
}

const DEFAULT_INFO: VersionInfo = { sourceUrl: DEFAULT_SOURCE_URL, installer: false }

export function pickSourceUrl(body: unknown): string {
  const url = (body as { source_url?: unknown } | null)?.source_url
  return typeof url === 'string' && /^https?:\/\//.test(url) ? url : DEFAULT_SOURCE_URL
}

export function pickVersionInfo(body: unknown): VersionInfo {
  return { sourceUrl: pickSourceUrl(body), installer: (body as { installer?: unknown } | null)?.installer === true }
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

import { useEffect, useState } from 'react'

// Arcanum is AGPL-3.0-or-later: an installation must offer its users the
// source of what it runs (§13). arcanum-bff's public /version tells where
// (its SOURCE_URL setting, so a modified installation can point to its own
// fork); until that answers — or if it can't — the upstream repos.
export const DEFAULT_SOURCE_URL = 'https://github.com/arcanum-pos'

export function pickSourceUrl(body: unknown): string {
  const url = (body as { source_url?: unknown } | null)?.source_url
  return typeof url === 'string' && /^https?:\/\//.test(url) ? url : DEFAULT_SOURCE_URL
}

export function useSourceUrl(): string {
  const [url, setUrl] = useState(DEFAULT_SOURCE_URL)
  useEffect(() => {
    let cancelled = false
    fetch('/version')
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => !cancelled && setUrl(pickSourceUrl(body)))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return url
}

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

const DEVICES_URL = '/api/devices'

export function LinkPanel({
  role,
  posTerminalId,
  posOrgId,
  refreshSignal,
}: {
  role: 'cfd' | 'sim'
  posTerminalId: string
  posOrgId: string
  refreshSignal: number
}) {
  const [loading, setLoading] = useState(true)
  const [linkedId, setLinkedId] = useState<string | null>(null)
  const [unlinked, setUnlinked] = useState<{ terminal_id: string }[]>([])
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [unlinking, setUnlinking] = useState(false)

  // No pruning here: the "unlinked" list from devicehub already filters to
  // devices holding a live notification socket, and the already-linked
  // device below is shown regardless of whether it's online right now — a
  // switched-off CFD stays linked, it just won't appear as a pickable
  // "unlinked" option under a different registration.
  const refresh = useCallback(async () => {
    setLoading(true)
    const [linkedRes, unlinkedRes] = await Promise.all([
      fetch(`${DEVICES_URL}/${encodeURIComponent(posTerminalId)}/linked?role=${role}`),
      fetch(`${DEVICES_URL}/unlinked?role=${role}&org_id=${encodeURIComponent(posOrgId)}`),
    ])
    const linked = await linkedRes.json().catch(() => null)
    const unlinkedList = await unlinkedRes.json().catch(() => [])
    setLinkedId(linked?.terminal_id || null)
    setUnlinked(unlinkedList || [])
    setLoading(false)
  }, [role, posTerminalId, posOrgId])

  useEffect(() => {
    refresh()
  }, [refresh, refreshSignal])

  async function handleLink(terminalId: string) {
    setLinkingId(terminalId)
    try {
      await fetch(`${DEVICES_URL}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pos_terminal_id: posTerminalId, terminal_id: terminalId }),
      })
      await refresh()
    } finally {
      setLinkingId(null)
    }
  }

  async function handleUnlink() {
    const linkedRes = await fetch(`${DEVICES_URL}/${encodeURIComponent(posTerminalId)}/linked?role=${role}`)
    const linked = await linkedRes.json().catch(() => null)
    if (!linked?.terminal_id) return

    setUnlinking(true)
    try {
      await fetch(`${DEVICES_URL}/unlink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terminal_id: linked.terminal_id }),
      })
      await refresh()
    } finally {
      setUnlinking(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{loading ? 'Gekoppeld: laden...' : linkedId ? `Gekoppeld: ${linkedId}` : 'Niets gekoppeld.'}</p>
      {linkedId && (
        <Button variant="outline" size="sm" className="w-fit" disabled={unlinking} onClick={handleUnlink}>
          Ontkoppelen
        </Button>
      )}
      {unlinked.length > 0 && (
        <div className="flex flex-col gap-1">
          {unlinked.map((d) => (
            <div key={d.terminal_id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <span>{d.terminal_id}</span>
              <Button size="sm" variant="secondary" disabled={linkingId === d.terminal_id} onClick={() => handleLink(d.terminal_id)}>
                Koppel
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button variant="ghost" size="sm" className="w-fit" onClick={refresh}>
        Vernieuwen
      </Button>
    </div>
  )
}

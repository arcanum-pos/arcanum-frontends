import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useMessages } from '@/shared/i18n'
import { getLinkedDevice, linkTerminals, listLinkableDisplays, unlinkTerminal } from '@/shared/terminal'
import { SETTINGS_MESSAGES } from './messages'

export function LinkPanel({
  posTerminalId,
  posOrgId,
  refreshSignal,
}: {
  posTerminalId: string
  posOrgId: string
  refreshSignal: number
}) {
  const m = useMessages(SETTINGS_MESSAGES)
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
    // Through arcanum-backend, which checks both devices are this org's.
    const [linked, unlinkedList] = await Promise.all([
      getLinkedDevice(posOrgId, posTerminalId),
      listLinkableDisplays(posOrgId, posTerminalId).catch(() => []),
    ])
    setLinkedId(linked?.terminal_id || null)
    setUnlinked(unlinkedList || [])
    setLoading(false)
  }, [posTerminalId, posOrgId])

  useEffect(() => {
    refresh()
  }, [refresh, refreshSignal])

  async function handleLink(terminalId: string) {
    setLinkingId(terminalId)
    try {
      await linkTerminals(posOrgId, posTerminalId, terminalId)
      await refresh()
    } finally {
      setLinkingId(null)
    }
  }

  async function handleUnlink() {
    const linked = await getLinkedDevice(posOrgId, posTerminalId)
    if (!linked?.terminal_id) return

    setUnlinking(true)
    try {
      await unlinkTerminal(posOrgId, linked.terminal_id)
      await refresh()
    } finally {
      setUnlinking(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{loading ? m.linkedLoading : linkedId ? m.linked(linkedId) : m.nothingLinked}</p>
      {linkedId && (
        <Button variant="outline" size="sm" className="w-fit" disabled={unlinking} onClick={handleUnlink}>
          {m.unlink}
        </Button>
      )}
      {unlinked.length > 0 && (
        <div className="flex flex-col gap-1">
          {unlinked.map((d) => (
            <div key={d.terminal_id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <span>{d.terminal_id}</span>
              <Button size="sm" variant="secondary" disabled={linkingId === d.terminal_id} onClick={() => handleLink(d.terminal_id)}>
                {m.link}
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button variant="ghost" size="sm" className="w-fit" onClick={refresh}>
        {m.refresh}
      </Button>
    </div>
  )
}

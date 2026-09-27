import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMessages } from '@/shared/i18n'
import { ADMIN_SHELL_MESSAGES } from '../messages/shell'

export function CopyLinkButton({ text }: { text: string }) {
  const m = useMessages(ADMIN_SHELL_MESSAGES)
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API can fail (permissions, insecure context) — the value
      // is still visible in the UI to copy by hand.
    }
  }

  return (
    <Button variant="ghost" size="icon" className="size-7" onClick={handleCopy} title={m.copy}>
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </Button>
  )
}

// Every screen runs under the real Content-Security-Policy (vite preview
// sends worker/csp.ts's): this fails a test when the browser refused
// anything on any page of it — a script, a style, an image, a connection.
import type { BrowserContext, ConsoleMessage } from '@playwright/test'

const VIOLATION = /Content Security Policy|Content-Security-Policy|Refused to (load|execute|apply|connect|evaluate|frame)/i

export function guardCsp(context: BrowserContext): () => string[] {
  const seen: string[] = []
  const watch = (message: ConsoleMessage) => {
    if (VIOLATION.test(message.text())) seen.push(`${message.page()?.url() ?? '?'}: ${message.text()}`)
  }
  for (const page of context.pages()) page.on('console', watch)
  context.on('page', (page) => page.on('console', watch))
  return () => seen
}

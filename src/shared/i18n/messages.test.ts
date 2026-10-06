import { describe, expect, it } from 'vitest'
import { ADMIN_CATALOG_MESSAGES } from '@/apps/admin/messages/catalog'
import { ADMIN_ORG_MESSAGES } from '@/apps/admin/messages/org'
import { ADMIN_SHELL_MESSAGES } from '@/apps/admin/messages/shell'
import { CHOOSER_MESSAGES } from '@/apps/chooser/messages'
import { DEVICE_MESSAGES } from '@/shared/device-login/messages'
import { DISPLAY_MESSAGES } from '@/apps/display/messages'
import { KASSA_MESSAGES } from '@/apps/kassa/messages'
import { LOGIN_PROMPT_MESSAGES } from '@/apps/login-prompt/messages'
import { SETTINGS_MESSAGES } from '@/apps/settings/messages'
import { STATUS_MESSAGES } from '@/shared/payment-labels'
import { LOCALES, type Messages } from '.'

// `satisfies` already catches a missing message at compile time; this also
// catches what types can't: an extra key, a Record-typed map (payWith,
// status labels) missing an entry, an empty text, a function whose
// parameters drifted.
const MESSAGE_SETS: Record<string, Messages<unknown>> = {
  'admin catalog': ADMIN_CATALOG_MESSAGES,
  'admin org': ADMIN_ORG_MESSAGES,
  'admin shell': ADMIN_SHELL_MESSAGES,
  chooser: CHOOSER_MESSAGES,
  device: DEVICE_MESSAGES,
  display: DISPLAY_MESSAGES,
  kassa: KASSA_MESSAGES,
  settings: SETTINGS_MESSAGES,
  'login prompt': LOGIN_PROMPT_MESSAGES,
  'payment status': STATUS_MESSAGES,
}

function shapeProblems(source: unknown, other: unknown, path: string): string[] {
  if (typeof source !== typeof other) return [`${path}: ${typeof other}, expected ${typeof source}`]
  if (typeof source === 'string') return (other as string).trim() ? [] : [`${path}: empty`]
  if (typeof source === 'function') {
    return (source as () => unknown).length === (other as () => unknown).length ? [] : [`${path}: takes ${(other as () => unknown).length} arguments, expected ${(source as () => unknown).length}`]
  }
  const a = source as Record<string, unknown>
  const b = other as Record<string, unknown>
  return [
    ...Object.keys(a).filter((k) => !(k in b)).map((k) => `${path}.${k}: missing`),
    ...Object.keys(b).filter((k) => !(k in a)).map((k) => `${path}.${k}: not in nl`),
    ...Object.keys(a).filter((k) => k in b).flatMap((k) => shapeProblems(a[k], b[k], `${path}.${k}`)),
  ]
}

describe.each(Object.entries(MESSAGE_SETS))('%s messages', (_name, messages) => {
  it.each(LOCALES)('%s has exactly the nl messages, none empty', (locale) => {
    expect(shapeProblems(messages.nl, messages[locale], locale)).toEqual([])
  })
})

describe('display messages', () => {
  it('words plurals per language', () => {
    expect(DISPLAY_MESSAGES.nl.items(1)).toBe('1 item')
    expect(DISPLAY_MESSAGES.nl.items(12)).toBe('12 items')
    expect(DISPLAY_MESSAGES.fr.items(1)).toBe('1 article')
    expect(DISPLAY_MESSAGES.fr.items(2)).toBe('2 articles')
  })

  it('builds the failed text from a status label', () => {
    expect(DISPLAY_MESSAGES.nl.failed(STATUS_MESSAGES.nl.CANCELLED)).toBe('Betaling geannuleerd — vraag het aan de toog')
    expect(DISPLAY_MESSAGES.en.failed(STATUS_MESSAGES.en.EXPIRED)).toBe('Payment expired — please ask at the counter')
  })
})

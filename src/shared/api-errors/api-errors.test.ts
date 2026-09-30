import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOCALES } from '@/shared/i18n'
import { API_ERROR_MESSAGES, apiErrorMessage } from '.'

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

function inLocale(lang: string) {
  vi.stubGlobal('document', { documentElement: { lang } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('API error messages', () => {
  it.each(LOCALES)('%s words every code with exactly the nl placeholders', (locale) => {
    const nl = API_ERROR_MESSAGES.nl
    const other = API_ERROR_MESSAGES[locale]
    expect(Object.keys(other).sort()).toEqual(Object.keys(nl).sort())
    for (const code of Object.keys(nl) as (keyof typeof nl)[]) {
      expect(other[code].trim(), code).not.toBe('')
      expect(placeholders(other[code]), code).toEqual(placeholders(nl[code]))
    }
  })
})

describe('apiErrorMessage', () => {
  it('words a known code in the screen language, filling its params', () => {
    inLocale('fr')
    expect(apiErrorMessage({ error: 'Rekening niet gevonden', code: 'tab_not_found' }, 'x')).toBe('Addition introuvable')
    inLocale('en')
    expect(apiErrorMessage({ error: '…', code: 'import_duplicate_code', params: { code: 'B1', otherRow: 4 } }, 'x')).toBe('Code "B1" is already on row 4')
  })

  it('Dutch is the server text itself', () => {
    inLocale('nl')
    expect(apiErrorMessage({ error: 'Maximaal 500 rijen per bestand', code: 'import_too_many_rows', params: { max: 500 } }, 'x')).toBe('Maximaal 500 rijen per bestand')
  })

  it('falls back to the server text for an unknown or missing code, then to the fallback', () => {
    inLocale('en')
    expect(apiErrorMessage({ error: 'orgId is required' }, 'Unknown error')).toBe('orgId is required')
    expect(apiErrorMessage({ error: 'Iets nieuws', code: 'some_future_code' }, 'Unknown error')).toBe('Iets nieuws')
    expect(apiErrorMessage(null, 'Unknown error')).toBe('Unknown error')
  })

  it("keeps a provider's own message as sent", () => {
    inLocale('en')
    expect(apiErrorMessage({ error: 'Reader offline', code: 'sumup_readers_failed', params: { detail: 'Reader offline' } }, 'x')).toBe('Reader offline')
    expect(apiErrorMessage({ error: 'Kon SumUp readers niet ophalen', code: 'sumup_readers_failed' }, 'x')).toBe('Could not fetch the SumUp readers')
  })
})

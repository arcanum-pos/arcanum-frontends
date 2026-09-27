import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ADMIN_LOCALE_KEY, LOCALES, isLocale, storeLocale, useLocale, useMessages, type Locale } from '@/shared/i18n'
import { setOrganizationLocale } from '../../lib/api'
import { useOrg } from '../../lib/org-context'
import { ADMIN_SHELL_MESSAGES } from '../../messages/shell'

// Each language named in itself, whatever the current one.
const LANGUAGE_NAMES: Record<Locale, string> = { nl: 'Nederlands', fr: 'Français', en: 'English' }

export default function PreferencesPage() {
  const m = useMessages(ADMIN_SHELL_MESSAGES)
  const { locale, setLocale } = useLocale()
  const { currentOrg, updateCurrentOrg } = useOrg()
  const [orgSave, setOrgSave] = useState<{ state: 'idle' | 'saving' | 'saved' } | { state: 'failed'; error: string }>({ state: 'idle' })

  // The admin's own pick, kept apart from a kassa's device language (see
  // ADMIN_LOCALE_KEY) — main.tsx starts from it on the next visit.
  function choose(value: string) {
    if (!isLocale(value)) return
    setLocale(value)
    storeLocale(value, ADMIN_LOCALE_KEY)
  }

  // The org's default (organizations.locale) — not this admin's own.
  async function chooseForOrg(value: string) {
    if (!currentOrg || !isLocale(value)) return
    setOrgSave({ state: 'saving' })
    try {
      await setOrganizationLocale(currentOrg.id, value)
      updateCurrentOrg({ locale: value })
      setOrgSave({ state: 'saved' })
    } catch (err) {
      setOrgSave({ state: 'failed', error: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-medium">{m.settingsNav.preferences}</h2>
        <p className="text-sm text-muted-foreground">{m.preferencesSubtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{m.language}</CardTitle>
          <CardDescription>{m.languageHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid max-w-xs gap-2">
            <Label htmlFor="admin-language">{m.language}</Label>
            <Select value={locale} onValueChange={choose}>
              <SelectTrigger id="admin-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((l) => (
                  <SelectItem key={l} value={l} lang={l}>
                    {LANGUAGE_NAMES[l]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {currentOrg && (
        <Card>
          <CardHeader>
            <CardTitle>{m.orgLanguage}</CardTitle>
            <CardDescription>{m.orgLanguageHint(currentOrg.name)}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid max-w-xs gap-2">
              <Label htmlFor="org-language">{m.orgLanguage}</Label>
              <Select value={currentOrg.locale ?? 'nl'} onValueChange={chooseForOrg} disabled={orgSave.state === 'saving'}>
                <SelectTrigger id="org-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map((l) => (
                    <SelectItem key={l} value={l} lang={l}>
                      {LANGUAGE_NAMES[l]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {orgSave.state === 'saved' && <p className="text-sm text-muted-foreground">{m.orgLanguageSaved}</p>}
              {orgSave.state === 'failed' && <p className="text-sm text-destructive">{m.orgLanguageFailed(orgSave.error)}</p>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

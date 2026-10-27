import { cn } from 'cn'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { LOCALES, storeLocale, useLocale, useMessages, type Locale, type Messages } from '@/shared/i18n'
import { THEMES, useTheme } from '@/shared/theme'
import { writePrefs, type KassaPrefs } from './prefs'

const TEXTS: Messages<{
  title: string
  reset: string
  done: string
  look: string
  theme: string
  themes: Record<(typeof THEMES)[number], string>
  language: string
  languageBusy: string
  layout: string
  tiles: string
  tileSizes: Record<KassaPrefs['tiles'], string>
  side: string
  sides: Record<KassaPrefs['side'], string>
  text: string
  textSizes: Record<KassaPrefs['text'], string>
  show: string
  counts: string
  countsHint: string
  tipButtons: string
  tipButtonsHint: string
  kept: string
}> = {
  nl: {
    title: 'Aanpassen',
    reset: 'Standaard',
    done: 'Gereed',
    look: 'Weergave',
    theme: 'Thema',
    themes: { light: 'Licht', dark: 'Donker', system: 'Systeem' },
    language: 'Taal',
    languageBusy: 'Stuur of reken eerst af wat nog niet doorgestuurd is: de kassa herlaadt in de nieuwe taal.',
    layout: 'Indeling',
    tiles: 'Productknoppen',
    tileSizes: { large: 'Groot', compact: 'Compact', list: 'Lijst' },
    side: 'Bestelling staat',
    sides: { right: 'Rechts', left: 'Links' },
    text: 'Tekstgrootte',
    textSizes: { small: 'Klein', normal: 'Normaal', large: 'Groot' },
    show: 'Tonen',
    counts: 'Aantallen op de knoppen',
    countsHint: 'Hoeveel de rekening er heeft (3×), donker zolang er nieuwe bij zijn',
    tipButtons: 'Fooiknoppen',
    tipButtonsHint: 'Snelle fooi naast Afrekenen; het bedrag kan altijd',
    kept: 'Bewaard op dit toestel. Elke kassa kan anders ingesteld zijn.',
  },
  fr: {
    title: 'Personnaliser',
    reset: 'Par défaut',
    done: 'OK',
    look: 'Affichage',
    theme: 'Thème',
    themes: { light: 'Clair', dark: 'Sombre', system: 'Système' },
    language: 'Langue',
    languageBusy: 'Envoyez ou encaissez d’abord ce qui n’est pas encore envoyé : la caisse se recharge dans la nouvelle langue.',
    layout: 'Disposition',
    tiles: 'Boutons des produits',
    tileSizes: { large: 'Grands', compact: 'Compacts', list: 'Liste' },
    side: 'Commande à',
    sides: { right: 'Droite', left: 'Gauche' },
    text: 'Taille du texte',
    textSizes: { small: 'Petit', normal: 'Normal', large: 'Grand' },
    show: 'Afficher',
    counts: 'Quantités sur les boutons',
    countsHint: 'Combien l’addition en a (3×), foncé tant qu’il y en a de nouveaux',
    tipButtons: 'Boutons de pourboire',
    tipButtonsHint: 'Pourboire rapide à côté d’Encaisser ; le montant reste possible',
    kept: 'Gardé sur cet appareil. Chaque caisse peut être réglée autrement.',
  },
  en: {
    title: 'Adjust',
    reset: 'Default',
    done: 'Done',
    look: 'Display',
    theme: 'Theme',
    themes: { light: 'Light', dark: 'Dark', system: 'System' },
    language: 'Language',
    languageBusy: 'Send or charge what isn’t sent yet first: the till reloads in the new language.',
    layout: 'Layout',
    tiles: 'Product buttons',
    tileSizes: { large: 'Large', compact: 'Compact', list: 'List' },
    side: 'Order on the',
    sides: { right: 'Right', left: 'Left' },
    text: 'Text size',
    textSizes: { small: 'Small', normal: 'Normal', large: 'Large' },
    show: 'Show',
    counts: 'Counts on the buttons',
    countsHint: 'How many the bill has (3×), dark while some are new',
    tipButtons: 'Tip buttons',
    tipButtonsHint: 'Quick tip next to Charge; an amount is always possible',
    kept: 'Kept on this device. Every till can be set differently.',
  },
}

const LANGUAGE_NAMES: Record<Locale, string> = { nl: 'Nederlands', fr: 'Français', en: 'English' }

// "Aanpassen" (KASSA_REDESIGN.md, phase 4): how this kassa looks, kept on the
// device - theme, language, product buttons, the ticket's side, text size,
// counts and tip buttons. The menu's arrangement stays in "Indeling aanpassen".
// The language reloads the kassa (its texts are fixed while it's open), so
// not while something isn't sent yet.
export function AdjustSheet({ open, onOpenChange, prefs, unsent }: { open: boolean; onOpenChange: (open: boolean) => void; prefs: KassaPrefs; unsent: boolean }) {
  const t = useMessages(TEXTS)
  const { theme, setTheme } = useTheme()
  const { locale } = useLocale()
  const set = (change: Partial<KassaPrefs>) => writePrefs({ ...prefs, ...change })
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" showCloseButton={false} overlayClassName="bg-transparent supports-backdrop-filter:backdrop-blur-none" className="w-[420px] max-w-[calc(100vw-2rem)] gap-0 overflow-y-auto bg-muted p-0 sm:max-w-[420px]" data-testid="adjust-sheet">
        <div className="sticky top-0 z-10 grid grid-cols-[1fr_auto_1fr] items-center border-b bg-muted px-4 py-3">
          <button
            type="button"
            className="justify-self-start rounded-md px-1 py-2 text-[15px] text-primary underline-offset-4 hover:underline"
            onClick={() => {
              writePrefs(null)
              setTheme('system')
            }}
          >
            {t.reset}
          </button>
          <SheetTitle className="text-[17px] font-semibold">{t.title}</SheetTitle>
          <button type="button" className="justify-self-end rounded-md px-1 py-2 text-[15px] font-semibold text-primary underline-offset-4 hover:underline" onClick={() => onOpenChange(false)}>
            {t.done}
          </button>
        </div>
        <SheetDescription className="sr-only">{t.kept}</SheetDescription>

        <div className="flex flex-col gap-1.5 px-4 pt-3 pb-5">
          <Heading>{t.look}</Heading>
          <Card>
            <Row label={t.theme}>
              <Segmented options={THEMES.map((v) => [v, t.themes[v]])} value={theme} onChange={setTheme} />
            </Row>
            <Row label={t.language} hint={unsent ? t.languageBusy : undefined}>
              <Segmented
                options={LOCALES.map((l) => [l, LANGUAGE_NAMES[l]])}
                value={locale}
                disabled={unsent}
                onChange={(l) => {
                  if (l === locale) return
                  storeLocale(l)
                  window.location.reload()
                }}
              />
            </Row>
          </Card>

          <Heading>{t.layout}</Heading>
          <Card>
            <Row label={t.tiles}>
              <Segmented options={(['large', 'compact', 'list'] as const).map((v) => [v, t.tileSizes[v]])} value={prefs.tiles} onChange={(tiles) => set({ tiles })} testId="adjust-tiles" />
            </Row>
            <Row label={t.side}>
              <Segmented options={(['right', 'left'] as const).map((v) => [v, t.sides[v]])} value={prefs.side} onChange={(side) => set({ side })} testId="adjust-side" />
            </Row>
            <Row label={t.text}>
              <Segmented options={(['small', 'normal', 'large'] as const).map((v) => [v, t.textSizes[v]])} value={prefs.text} onChange={(text) => set({ text })} testId="adjust-text" />
            </Row>
          </Card>

          <Heading>{t.show}</Heading>
          <Card>
            <Toggle label={t.counts} hint={t.countsHint} checked={prefs.counts} onChange={(counts) => set({ counts })} />
            <Toggle label={t.tipButtons} hint={t.tipButtonsHint} checked={prefs.tipButtons} onChange={(tipButtons) => set({ tipButtons })} />
          </Card>
          <p className="px-3.5 pt-2 text-[12.5px] leading-snug text-muted-foreground">{t.kept}</p>
        </div>
      </SheetContent>
    </Sheet>
  )
}


function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="px-3.5 pt-3 pb-1 text-[12px] font-medium tracking-[0.03em] text-muted-foreground uppercase">{children}</h3>
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-xl bg-card [&>*+*]:border-t">{children}</div>
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 px-3.5 py-3">
      <span className="text-[15px]">{label}</span>
      {children}
      {hint && <p className="text-[12.5px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  )
}

// One choice out of a few, as a segmented control (a group of pressed buttons).
function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  testId,
}: {
  options: [T, string][]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
  testId?: string
}) {
  return (
    <div className="grid gap-0.5 rounded-[10px] bg-muted p-0.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="group" data-testid={testId}>
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          disabled={disabled}
          onClick={() => onChange(v)}
          className={cn(
            'min-h-10 min-w-0 rounded-[8px] px-1 text-[14px] leading-tight transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50',
            v === value ? 'bg-card font-semibold text-foreground shadow-sm' : 'font-medium text-muted-foreground hover:text-foreground'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center gap-3 px-3.5 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">{label}</span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  )
}

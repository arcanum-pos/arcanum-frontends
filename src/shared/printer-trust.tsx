import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMessages, type Messages } from '@/shared/i18n'
import { cn } from 'cn'
import { certUploadUrl, checkReachable, newProfileLink, newTrustCode, showFingerprint, type Printer } from './printing'
import { detectPlatform, trustCommand, type TrustPlatform, type TrustSay } from './printer-trust-commands'

// Trusting a push printer on this device (arcanum/PRINTING.md, "Trusting a
// push printer"). A page can't fetch or trust a certificate itself, so:
// does this device reach the printer? If not, on a computer: a command to
// paste (it uploads the printer's certificate to Arcanum and trusts it
// here); on an iPad or iPhone: a profile with that certificate, opened in
// Safari (a Home Screen app can't install one), then two steps in Settings.

type Texts = {
  checking: string
  reachable: string
  unreachable: string
  checkAgain: string
  trustHere: string
  device: string
  platforms: Record<TrustPlatform, string>
  showCommand: string
  copy: string
  copied: string
  codeValid: string
  steps: Record<Exclude<TrustPlatform, 'ios'>, string[]>
  afterwards: string
  say: TrustSay
  download: string
  iosSteps: string[]
  needsUpload: string
  tryAgain: string
  uploaded: (date: string, fingerprint: string) => string
}

const TEXTS: Messages<Texts> = {
  nl: {
    checking: 'Kijken of dit toestel de printer bereikt…',
    reachable: 'Dit toestel bereikt de printer.',
    unreachable: 'Dit toestel bereikt de printer niet. Staat hij aan? Dan moet dit toestel hem eerst vertrouwen.',
    checkAgain: 'Opnieuw controleren',
    trustHere: 'Printer vertrouwen op dit toestel',
    device: 'Toestel',
    platforms: {
      ios: 'iPad of iPhone',
      mac: 'Mac',
      windows: 'Windows',
      linux: 'Linux of Chromebook',
    },
    showCommand: 'Toon het commando',
    copy: 'Kopieer',
    copied: 'Gekopieerd',
    codeValid: 'Het commando werkt 15 minuten en één keer. Het laadt ook het certificaat van de printer op naar Arcanum, zodat een iPad het kan downloaden.',
    steps: {
      mac: ['Kopieer het commando.', 'Open Terminal (Spotlight: typ Terminal).', 'Plak het commando en druk op Enter.', 'Je Mac vraagt je wachtwoord om de printer te vertrouwen.'],
      windows: ['Kopieer het commando.', 'Open PowerShell (Start, typ PowerShell).', 'Plak het commando en druk op Enter.', 'Windows vraagt of je het certificaat wilt installeren: kies Ja.'],
      linux: ['Kopieer het commando.', 'Open een terminal.', 'Plak het commando en druk op Enter.'],
    },
    afterwards: 'Daarna: sluit dit scherm, open het opnieuw en kies Opnieuw controleren.',
    say: {
      trusted: 'Klaar: deze computer vertrouwt de printer nu.',
      noCertutil: (f) => `certutil ontbreekt (pakket libnss3-tools). Importeer ${f} in Chrome: Instellingen, Privacy en beveiliging, Beveiliging, Certificaten beheren.`,
    },
    download: 'Download profiel',
    iosSteps: [
      'Tik op Download profiel en kies Sta toe (het opent in Safari).',
      'Open Instellingen, tik Profiel gedownload en dan Installeer.',
      'Ga naar Instellingen, Algemeen, Info, Instellingen voor certificaatvertrouwen en zet de printer aan.',
      'Kom terug naar dit scherm en tik Opnieuw controleren.',
    ],
    needsUpload: 'Het certificaat van de printer is nog niet opgeladen. Doe dat eerst één keer vanop een computer op hetzelfde netwerk: kies daar de printer en "Printer vertrouwen op dit toestel".',
    tryAgain: 'Opnieuw proberen',
    uploaded: (d, f) => `Certificaat opgeladen op ${d} - vingerafdruk ${f}`,
  },
  fr: {
    checking: 'Vérification que cet appareil joint l’imprimante…',
    reachable: 'Cet appareil joint l’imprimante.',
    unreachable: 'Cet appareil ne joint pas l’imprimante. Est-elle allumée ? Alors cet appareil doit d’abord lui faire confiance.',
    checkAgain: 'Vérifier à nouveau',
    trustHere: 'Faire confiance à l’imprimante sur cet appareil',
    device: 'Appareil',
    platforms: {
      ios: 'iPad ou iPhone',
      mac: 'Mac',
      windows: 'Windows',
      linux: 'Linux ou Chromebook',
    },
    showCommand: 'Afficher la commande',
    copy: 'Copier',
    copied: 'Copié',
    codeValid: 'La commande fonctionne 15 minutes et une seule fois. Elle envoie aussi le certificat de l’imprimante à Arcanum, pour qu’un iPad puisse le télécharger.',
    steps: {
      mac: ['Copiez la commande.', 'Ouvrez Terminal (Spotlight : tapez Terminal).', 'Collez la commande et appuyez sur Entrée.', 'Votre Mac demande votre mot de passe pour faire confiance à l’imprimante.'],
      windows: ['Copiez la commande.', 'Ouvrez PowerShell (Démarrer, tapez PowerShell).', 'Collez la commande et appuyez sur Entrée.', 'Windows demande s’il faut installer le certificat : choisissez Oui.'],
      linux: ['Copiez la commande.', 'Ouvrez un terminal.', 'Collez la commande et appuyez sur Entrée.'],
    },
    afterwards: 'Ensuite : fermez cet écran, rouvrez-le et choisissez Vérifier à nouveau.',
    say: {
      trusted: 'Terminé : cet ordinateur fait maintenant confiance à l’imprimante.',
      noCertutil: (f) => `certutil manque (paquet libnss3-tools). Importez ${f} dans Chrome : Paramètres, Confidentialité et sécurité, Sécurité, Gérer les certificats.`,
    },
    download: 'Télécharger le profil',
    iosSteps: [
      'Touchez Télécharger le profil et choisissez Autoriser (il s’ouvre dans Safari).',
      'Ouvrez Réglages, touchez Profil téléchargé puis Installer.',
      'Allez dans Réglages, Général, Informations, Réglages des certificats et activez l’imprimante.',
      'Revenez à cet écran et touchez Vérifier à nouveau.',
    ],
    needsUpload: 'Le certificat de l’imprimante n’a pas encore été envoyé. Faites-le d’abord une fois depuis un ordinateur sur le même réseau : choisissez-y l’imprimante et « Faire confiance à l’imprimante sur cet appareil ».',
    tryAgain: 'Réessayer',
    uploaded: (d, f) => `Certificat envoyé le ${d} - empreinte ${f}`,
  },
  en: {
    checking: 'Checking whether this device reaches the printer…',
    reachable: 'This device reaches the printer.',
    unreachable: "This device doesn't reach the printer. Is it on? Then this device has to trust it first.",
    checkAgain: 'Check again',
    trustHere: 'Trust the printer on this device',
    device: 'Device',
    platforms: {
      ios: 'iPad or iPhone',
      mac: 'Mac',
      windows: 'Windows',
      linux: 'Linux or Chromebook',
    },
    showCommand: 'Show the command',
    copy: 'Copy',
    copied: 'Copied',
    codeValid: "The command works for 15 minutes, once. It also uploads the printer's certificate to Arcanum, so an iPad can download it.",
    steps: {
      mac: ['Copy the command.', 'Open Terminal (Spotlight: type Terminal).', 'Paste the command and press Enter.', 'Your Mac asks for your password to trust the printer.'],
      windows: ['Copy the command.', 'Open PowerShell (Start, type PowerShell).', 'Paste the command and press Enter.', 'Windows asks whether to install the certificate: choose Yes.'],
      linux: ['Copy the command.', 'Open a terminal.', 'Paste the command and press Enter.'],
    },
    afterwards: 'Afterwards: close this screen, open it again and choose Check again.',
    say: {
      trusted: 'Done: this computer now trusts the printer.',
      noCertutil: (f) => `certutil is missing (package libnss3-tools). Import ${f} in Chrome: Settings, Privacy and security, Security, Manage certificates.`,
    },
    download: 'Download profile',
    iosSteps: ['Tap Download profile and choose Allow (it opens in Safari).', 'Open Settings, tap Profile Downloaded, then Install.', 'Go to Settings, General, About, Certificate Trust Settings and switch the printer on.', 'Come back to this screen and tap Check again.'],
    needsUpload: 'The printer\'s certificate hasn\'t been uploaded yet. Do that once first from a computer on the same network: choose the printer there and "Trust the printer on this device".',
    tryAgain: 'Try again',
    uploaded: (d, f) => `Certificate uploaded on ${d} - fingerprint ${f}`,
  },
}

export function PrinterTrust({ orgId, printer }: { orgId: string; printer: Printer }) {
  const t = useMessages(TEXTS)
  const [reach, setReach] = useState<'checking' | 'ok' | 'no'>('checking')
  const [open, setOpen] = useState(false)
  const [platform, setPlatform] = useState<TrustPlatform>(() => detectPlatform(navigator))

  const check = useCallback(async () => {
    setReach('checking')
    const ok = await checkReachable(printer)
    setReach(ok ? 'ok' : 'no')
    if (!ok) setOpen(true)
  }, [printer])

  useEffect(() => {
    void check()
  }, [check])

  return (
    <div className="grid gap-3" data-testid="printer-trust" data-reach={reach}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn('flex items-center gap-2 text-sm', reach === 'no' && 'text-destructive')} role="status">
          <span className={cn('size-2 shrink-0 rounded-full', reach === 'ok' ? 'bg-green-500' : reach === 'no' ? 'bg-red-500' : 'animate-pulse bg-muted-foreground/40')} aria-hidden="true" />
          {reach === 'checking' ? t.checking : reach === 'ok' ? t.reachable : t.unreachable}
        </p>
        <Button size="sm" variant="outline" onClick={check} disabled={reach === 'checking'}>
          {t.checkAgain}
        </Button>
      </div>
      {!open ? (
        <Button variant="outline" className="justify-self-start" onClick={() => setOpen(true)}>
          {t.trustHere}
        </Button>
      ) : (
        <div className="grid gap-3 rounded-md border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">{t.trustHere}</h3>
            <Select value={platform} onValueChange={(v) => setPlatform(v as TrustPlatform)}>
              <SelectTrigger aria-label={t.device} className="h-8 w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['ios', 'mac', 'windows', 'linux'] as const).map((p) => (
                  <SelectItem key={p} value={p}>
                    {t.platforms[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {platform === 'ios' ? <Profile orgId={orgId} printer={printer} t={t} /> : <Command key={platform} orgId={orgId} printer={printer} platform={platform} t={t} />}
          {printer.certFingerprint && printer.certUploadedAt && (
            <p className="break-all text-xs text-muted-foreground" data-testid="printer-cert">
              {t.uploaded(new Date(printer.certUploadedAt).toLocaleDateString(), showFingerprint(printer.certFingerprint))}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Command({ orgId, printer, platform, t }: { orgId: string; printer: Printer; platform: Exclude<TrustPlatform, 'ios'>; t: Texts }) {
  const [command, setCommand] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function show() {
    setBusy(true)
    setError(null)
    try {
      const { code } = await newTrustCode(orgId, printer.id)
      setCommand(
        trustCommand(
          platform,
          {
            host: printer.host || '',
            port: printer.port || 443,
            uploadUrl: certUploadUrl(printer.id, code),
          },
          t.say
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-2">
      <ol className="grid list-decimal gap-1 pl-5 text-sm">
        {t.steps[platform].map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {command ? (
        <>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 font-mono text-xs" data-testid="trust-command">
            {command}
          </pre>
          <Button
            variant="outline"
            className="justify-self-start"
            onClick={async () => {
              await navigator.clipboard?.writeText(command).then(
                () => setCopied(true),
                () => {}
              )
            }}
          >
            {copied ? t.copied : t.copy}
          </Button>
          <p className="text-xs text-muted-foreground">{t.codeValid}</p>
          <p className="text-xs text-muted-foreground">{t.afterwards}</p>
        </>
      ) : (
        <Button variant="outline" className="justify-self-start" onClick={show} disabled={busy}>
          {t.showCommand}
        </Button>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

// The profile's link is made when shown (10 minutes) and again after 9: a
// plain link, so Safari opens it on the tap itself.
function Profile({ orgId, printer, t }: { orgId: string; printer: Printer; t: Texts }) {
  const [link, setLink] = useState<{ url: string } | { missing: true } | { error: string } | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    const load = () =>
      newProfileLink(orgId, printer.id).then(
        (l) => live && setLink({ url: l.url }),
        (err) => live && setLink(err?.code === 'printer_no_certificate' ? { missing: true } : { error: err instanceof Error ? err.message : String(err) })
      )
    void load()
    const timer = setInterval(load, 9 * 60_000)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [orgId, printer.id, attempt])

  if (!link) return null
  if ('missing' in link || 'error' in link)
    return (
      <div className="grid gap-2">
        <p className={cn('text-sm', 'error' in link ? 'text-destructive' : 'text-muted-foreground')}>{'error' in link ? link.error : t.needsUpload}</p>
        <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setAttempt((n) => n + 1)}>
          {t.tryAgain}
        </Button>
      </div>
    )
  return (
    <div className="grid gap-2">
      <ol className="grid list-decimal gap-1 pl-5 text-sm">
        {t.iosSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <Button asChild className="justify-self-start">
        <a href={link.url} target="_blank" rel="noopener" data-testid="profile-link">
          {t.download}
        </a>
      </Button>
    </div>
  )
}

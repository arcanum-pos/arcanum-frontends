// The invitation to pass on yourself (WhatsApp, a text message, …) when the
// installation sent no mail — none set up, or it failed (MAIL.md). Same
// words as the invite mail (arcanum-backend's email-templates/invite.ts), in
// the organisation's language — the invitee's, not the admin's console
// language — except that it names the address to sign in with, since it
// didn't arrive at that address.
import type { Locale } from '@/shared/i18n'

interface InviteCopy {
  roles: Record<'admin' | 'cashier', string>
  invited: (orgName: string, roleLabel: string) => string
  login: string
  sameAddress: (email: string) => string
}

const COPY: Record<Locale, InviteCopy> = {
  nl: {
    roles: { admin: 'beheerder', cashier: 'kassier' },
    invited: (org, role) => `Je bent uitgenodigd om lid te worden van ${org} op Arcanum, als ${role}.`,
    login: 'Meld je aan om je uitnodiging te activeren',
    sameAddress: (email) => `Meld je aan met het e-mailadres ${email}.`,
  },
  fr: {
    roles: { admin: 'administrateur', cashier: 'caissier' },
    // "en tant qu’administrateur" — elided before a vowel.
    invited: (org, role) => `Vous êtes invité(e) à rejoindre ${org} sur Arcanum, en tant ${/^[aeiouyéèh]/i.test(role) ? 'qu’' : 'que '}${role}.`,
    login: 'Connectez-vous pour activer votre invitation',
    sameAddress: (email) => `Connectez-vous avec l’adresse e-mail ${email}.`,
  },
  en: {
    roles: { admin: 'an administrator', cashier: 'a cashier' },
    invited: (org, role) => `You have been invited to join ${org} on Arcanum, as ${role}.`,
    login: 'Log in to activate your invitation',
    sameAddress: (email) => `Please log in with the email address ${email}.`,
  },
}

// French puts a (non-breaking) space before a colon.
const COLON: Record<Locale, string> = { nl: ':', fr: ' :', en: ':' }

export function inviteText(params: { orgName: string; role: 'admin' | 'cashier'; email: string; loginUrl: string; locale?: Locale }): string {
  const locale = params.locale && params.locale in COPY ? params.locale : 'nl'
  const copy = COPY[locale]
  return [
    copy.invited(params.orgName, copy.roles[params.role]),
    '',
    `${copy.login}${COLON[locale]} ${params.loginUrl}`,
    '',
    copy.sameAddress(params.email),
  ].join('\n')
}

// Where an invitee signs in: this installation's own address (the console
// runs on it too).
export function loginUrl(): string {
  return `${window.location.origin}/login`
}

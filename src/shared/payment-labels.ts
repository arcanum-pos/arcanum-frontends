import type { Messages } from '@/shared/i18n'

// Shared between the POS (kassa) and the customer display — used to be
// duplicated verbatim in both (see arcanum-webapp/src/lib/paymentLabels.ts,
// its now-unported copy).
const nl: Record<string, string> = {
  PENDING: 'In afwachting',
  IDENTIFIED: 'Gescand, wordt bevestigd',
  AUTHORIZED: 'Wordt verwerkt',
  AUTHORIZATION_FAILED: 'Autorisatie mislukt',
  FAILED: 'Mislukt',
  SUCCEEDED: 'Betaald',
  CANCELLED: 'Geannuleerd',
  EXPIRED: 'Verlopen',
  PENDING_MERCHANT_ACKNOWLEDGEMENT: 'Wacht op bevestiging',
  VOIDED: 'Ongeldig gemaakt',
}

export const STATUS_MESSAGES: Messages<Record<string, string>> = {
  nl,
  fr: {
    PENDING: 'En attente',
    IDENTIFIED: 'Scanné, en cours de confirmation',
    AUTHORIZED: 'En cours de traitement',
    AUTHORIZATION_FAILED: 'Autorisation refusée',
    FAILED: 'Échoué',
    SUCCEEDED: 'Payé',
    CANCELLED: 'Annulé',
    EXPIRED: 'Expiré',
    PENDING_MERCHANT_ACKNOWLEDGEMENT: 'En attente de confirmation',
    VOIDED: 'Invalidé',
  },
  en: {
    PENDING: 'Pending',
    IDENTIFIED: 'Scanned, being confirmed',
    AUTHORIZED: 'Processing',
    AUTHORIZATION_FAILED: 'Authorisation failed',
    FAILED: 'Failed',
    SUCCEEDED: 'Paid',
    CANCELLED: 'Cancelled',
    EXPIRED: 'Expired',
    PENDING_MERCHANT_ACKNOWLEDGEMENT: 'Awaiting confirmation',
    VOIDED: 'Voided',
  },
}

// The kassa isn't translated yet — it keeps the Dutch labels.
export const STATUS_LABELS = nl

// Shared between the POS (kassa) and the customer display — used to be
// duplicated verbatim in both (see arcanum-webapp/src/lib/paymentLabels.ts,
// its now-unported copy).
export const STATUS_LABELS: Record<string, string> = {
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

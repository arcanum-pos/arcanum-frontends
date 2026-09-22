// Shared between the POS (arcanum-webapp's app.ts, not migrated yet) and
// this customer display — kept in sync manually since they're now separate
// repos/deployables. See arcanum-webapp/src/lib/paymentLabels.ts for its
// copy.
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

export const CASH_VIEW_LABELS: Record<string, string> = {
  cash: 'Gelieve contant te betalen',
  sumup: 'Gelieve te betalen via SumUp',
  bancontact: 'Gelieve te betalen via Bancontact',
}

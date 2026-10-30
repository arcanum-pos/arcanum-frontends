// The customer display's branding (arcanum-backend's branding.ts): the
// organisation's logo and two colours — a main colour (the display's header
// and total panel) and an accent (highlights) — the event's own colours
// where it has them. Read publicly (/api/public/branding/…): a display
// paired by code alone has no session. Set in the console, Instellingen →
// Weergave → Klantscherm. Only the customer display uses it.

export interface Branding {
  primary: string | null
  accent: string | null
  logoUrl: string | null
}

export const NO_BRANDING: Branding = { primary: null, accent: null, logoUrl: null }

const COLOR = /^#[0-9a-f]{6}$/i

function readColor(value: unknown): string | null {
  return typeof value === 'string' && COLOR.test(value) ? value.toLowerCase() : null
}

// Only from this installation's own branding route — nothing else from the wire.
function readLogoUrl(value: unknown): string | null {
  return typeof value === 'string' && /^\/api\/public\/branding\/[^/?#]+\/logo\.png(\?[^#]*)?$/.test(value) ? value : null
}

export function readBranding(value: unknown): Branding {
  const v = (value ?? {}) as Record<string, unknown>
  return { primary: readColor(v.primary), accent: readColor(v.accent), logoUrl: readLogoUrl(v.logoUrl) }
}

export async function fetchBranding(orgId: string, eventId: string | null): Promise<Branding> {
  const query = eventId ? `?event=${encodeURIComponent(eventId)}` : ''
  const res = await fetch(`/api/public/branding/${encodeURIComponent(orgId)}${query}`)
  if (!res.ok) return NO_BRANDING
  return readBranding(await res.json().catch(() => null))
}

// WCAG relative luminance of #rrggbb.
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

const NEAR_BLACK = '#0a0a0a'

// Text on a background of this colour: near-black or white, whichever reads
// better (the higher contrast, measured with the near-black it shows, not
// pure black) — scouts green gets white, a yellow scarf black.
export function textOn(hex: string): string {
  const l = luminance(hex)
  return (l + 0.05) / (luminance(NEAR_BLACK) + 0.05) > 1.05 / (l + 0.05) ? NEAR_BLACK : '#ffffff'
}

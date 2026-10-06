import type { Role } from '@/shared/terminal'

// The org/device-role chooser's texts — the source of truth; fr.ts and en.ts
// must match this shape (see src/shared/i18n).
const nl = {
  whichOrg: 'Voor welke organisatie is dit toestel?',
  whichRole: 'Wat is dit toestel?',
  org: (name: string) => `Organisatie: ${name}`,
  roles: {
    pos: { title: 'Kassa', hint: 'Bonnen verkopen en betalingen aanmaken' },
    cfd: { title: 'Klantscherm', hint: 'Toont QR-codes en betaalstatus aan de klant' },
  } satisfies Record<Role, { title: string; hint: string }>,
}

export type ChooserMessages = typeof nl
export default nl

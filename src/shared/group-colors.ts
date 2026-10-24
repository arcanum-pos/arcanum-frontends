import type { Messages } from './i18n'

// A menu group's colour on the kassa (KASSA_REDESIGN.md, decisions 2 and
// phase 6): a fixed palette, each dark enough for white text on it (WCAG AA,
// ≥ 4.5:1), the group's box a light tint of it. Chosen per group in the
// console's menu editor, else automatic by the group's place in the menu.
// The backend accepts exactly these (arcanum-backend catalog.ts SECTION_COLORS).
export const GROUP_COLORS = ['#2563eb', '#c2410c', '#be185d', '#15803d', '#7c3aed', '#0f766e', '#b45309', '#4f46e5'] as const

export const groupColor = (index: number) => GROUP_COLORS[((index % GROUP_COLORS.length) + GROUP_COLORS.length) % GROUP_COLORS.length]

// The colour a group shows: its own, else the automatic one for its place.
export const sectionColor = (chosen: string | null | undefined, index: number) =>
  chosen && (GROUP_COLORS as readonly string[]).includes(chosen) ? chosen : groupColor(index)

// Their names, for whoever can't tell them apart (and screen readers).
export const GROUP_COLOR_NAMES: Messages<string[]> = {
  nl: ['Blauw', 'Oranje', 'Roze', 'Groen', 'Paars', 'Blauwgroen', 'Oker', 'Indigo'],
  fr: ['Bleu', 'Orange', 'Rose', 'Vert', 'Violet', 'Bleu-vert', 'Ocre', 'Indigo'],
  en: ['Blue', 'Orange', 'Pink', 'Green', 'Purple', 'Teal', 'Ochre', 'Indigo'],
}

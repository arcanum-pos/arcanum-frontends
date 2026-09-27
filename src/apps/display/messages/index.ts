import type { Messages } from '@/shared/i18n'
import en from './en'
import fr from './fr'
import nl, { type DisplayMessages } from './nl'

export const DISPLAY_MESSAGES: Messages<DisplayMessages> = { nl, fr, en }

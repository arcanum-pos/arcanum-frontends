import type { Messages } from '@/shared/i18n'
import en from './en'
import fr from './fr'
import nl, { type TapMessages } from './nl'

export const TAP_MESSAGES: Messages<TapMessages> = { nl, fr, en }

import type { Messages } from '@/shared/i18n'
import en from './en'
import fr from './fr'
import nl, { type KassaMessages } from './nl'

export const KASSA_MESSAGES: Messages<KassaMessages> = { nl, fr, en }

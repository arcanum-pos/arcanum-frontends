import type { Messages } from '@/shared/i18n'
import en from './en'
import fr from './fr'
import nl, { type SelfOrderMessages } from './nl'

export const SELF_ORDER_MESSAGES: Messages<SelfOrderMessages> = { nl, fr, en }

import type { Messages } from '@/shared/i18n'
import en from './en'
import fr from './fr'
import nl, { type WaiterMessages } from './nl'

export const WAITER_MESSAGES: Messages<WaiterMessages> = { nl, fr, en }

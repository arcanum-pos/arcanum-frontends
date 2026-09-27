import type { Messages } from '@/shared/i18n'
import en from './en'
import fr from './fr'
import nl, { type ChooserMessages } from './nl'

export const CHOOSER_MESSAGES: Messages<ChooserMessages> = { nl, fr, en }

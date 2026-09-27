import type { Messages } from '@/shared/i18n'
import en from './en'
import fr from './fr'
import nl, { type SettingsMessages } from './nl'

export const SETTINGS_MESSAGES: Messages<SettingsMessages> = { nl, fr, en }

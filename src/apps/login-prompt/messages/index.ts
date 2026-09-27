import type { Messages } from '@/shared/i18n'
import en from './en'
import fr from './fr'
import nl, { type LoginPromptMessages } from './nl'

export const LOGIN_PROMPT_MESSAGES: Messages<LoginPromptMessages> = { nl, fr, en }

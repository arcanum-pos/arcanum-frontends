import type { Messages } from '@/shared/i18n'
import en from './en'
import fr from './fr'
import nl, { type AdminShellMessages } from './nl'

export const ADMIN_SHELL_MESSAGES: Messages<AdminShellMessages> = { nl, fr, en }

import type { Messages } from '@/shared/i18n'
import en from './en'
import fr from './fr'
import nl, { type SimulatorMessages } from './nl'

export const SIMULATOR_MESSAGES: Messages<SimulatorMessages> = { nl, fr, en }

import type { Messages } from '@/shared/i18n'
import en from './en'
import fr from './fr'
import nl, { type StationMessages } from './nl'

export const STATION_MESSAGES: Messages<StationMessages> = { nl, fr, en }

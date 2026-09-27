import type { Messages } from '@/shared/i18n'
import en from './en'
import fr from './fr'
import nl, { type DeviceMessages } from './nl'

export const DEVICE_MESSAGES: Messages<DeviceMessages> = { nl, fr, en }

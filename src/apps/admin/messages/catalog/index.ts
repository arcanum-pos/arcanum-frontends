import type { Messages } from '@/shared/i18n'
import en from './en'
import fr from './fr'
import nl, { type AdminCatalogMessages } from './nl'

export const ADMIN_CATALOG_MESSAGES: Messages<AdminCatalogMessages> = { nl, fr, en }

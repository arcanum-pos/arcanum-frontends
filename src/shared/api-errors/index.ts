import { currentLocale, type Messages } from '../i18n'
import en from './en'
import fr from './fr'
import nl, { type ApiErrorCode, type ApiErrorMessages } from './nl'

export type { ApiErrorCode }
export const API_ERROR_MESSAGES: Messages<ApiErrorMessages> = { nl, fr, en }

// What arcanum-backend sends for a user-facing error: its Dutch `error`,
// plus a `code` (and the values it interpolated, `params`) for the
// frontend to word in its own language.
export interface ApiErrorBody {
  error?: unknown
  code?: unknown
  params?: unknown
}

export function isApiErrorCode(code: unknown): code is ApiErrorCode {
  return typeof code === 'string' && Object.hasOwn(nl, code)
}

// The error worded from `texts` (one language's API_ERROR_MESSAGES — in a
// component: useMessages(API_ERROR_MESSAGES), so it follows a live switch).
// An unknown or missing code falls back to the server's own text, then to
// `fallback`. A provider's own message (params.detail: Cloudflare's,
// SumUp's) is shown as the server sent it.
export function apiErrorText(texts: ApiErrorMessages, body: ApiErrorBody | null | undefined, fallback: string): string {
  const serverText = typeof body?.error === 'string' && body.error ? body.error : fallback
  if (!body || !isApiErrorCode(body.code)) return serverText
  const params = body.params && typeof body.params === 'object' ? (body.params as Record<string, unknown>) : {}
  if (typeof params.detail === 'string' && params.detail) return serverText
  return texts[body.code].replace(/\{(\w+)\}/g, (whole, name: string) =>
    params[name] === undefined || params[name] === null ? whole : String(params[name])
  )
}

// For an API client outside React (turning a response into an Error): the
// screen's current language (currentLocale). Worded when the error
// arrives, so a later language switch doesn't reword one already shown.
export function apiErrorMessage(body: ApiErrorBody | null | undefined, fallback: string): string {
  return apiErrorText(API_ERROR_MESSAGES[currentLocale()], body, fallback)
}

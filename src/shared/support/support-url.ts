// The platform's support form (arcanum-support, SUPPORT.md): the same for
// every installation, like DOCS_URL. The ? button opens it in a dialog.
export const SUPPORT_URL = 'https://support.kaboutersoft.be'
export const SUPPORT_ORIGIN = new URL(SUPPORT_URL).origin

export function supportFrameUrl(locale: string, theme: 'light' | 'dark'): string {
  return `${SUPPORT_URL}/?${new URLSearchParams({ embed: '1', lang: locale, theme })}`
}

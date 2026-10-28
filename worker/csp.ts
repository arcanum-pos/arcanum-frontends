// The Content-Security-Policy of every screen (console, kassa, customer
// display, settings, simulator, chooser, device QR page, login prompt): the
// Worker sends it with each HTML page, `vite preview` with everything — so
// the Playwright suite runs every screen under exactly this policy, and fails
// on any violation (e2e/csp-guard.ts).
//
//   script-src 'self'       one module script per page, from /assets — no
//                           inline script, no eval: injected script can't run
//   style-src 'unsafe-inline'  the UI components set some styles inline
//   img-src https: data: blob:  the Bancontact QR code (Bancontact's own host),
//                           an org's logo (any URL its admin enters)
//   connect-src 'self'      the API and the notification socket (same host)
//   frame-src               the support form's dialog (shared/support), only
//                           that one origin
//   frame-ancestors 'none'  never inside another site's frame
//
// A screen that prints (PRINTING_PAGES) also connects to the printer on its
// network (arcanum/PRINTING.md): connect-src adds https: - a printer's local
// address can't be listed in advance. No more than img-src already allows.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'frame-src https://support.kaboutersoft.be',
  "frame-ancestors 'none'",
].join('; ');

// By name without .html: Cloudflare's assets redirect /station.html to
// /station, and that's the page the browser gets.
// The station screen (its tickets), the kassa and the waiter's screen (receipts).
export const PRINTING_PAGES = new Set(['/station', '/kassa', '/waiter'])
export const PRINTING_POLICY = CONTENT_SECURITY_POLICY.replace("connect-src 'self'", "connect-src 'self' https:")

export const policyFor = (pathname: string) => (PRINTING_PAGES.has(pathname.replace(/\.html$/, '')) ? PRINTING_POLICY : CONTENT_SECURITY_POLICY)

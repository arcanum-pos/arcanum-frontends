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
//   frame-ancestors 'none'  never inside another site's frame
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
  "frame-ancestors 'none'",
].join('; ');

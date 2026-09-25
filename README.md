# arcanum-frontends


Every UI screen the platform serves — the admin portal (`admin`, at
`/console`), kassa, settings, the customer display, the SumUp simulator, the
org/device chooser, the login prompt, and the device-grant QR page, all
reached behind `arcanum-bff` — as one Vite project with multiple independent
HTML entry points, not one Worker per screen type. `arcanum-webapp`, which
used to serve several of these, is retired.

## Why this shape

- **One deployment, many screens.** Each screen (`admin`, later `kassa`,
  `bar`, `kitchen`, ...) is its own HTML entry + its own `src/apps/<name>/`
  folder. Vite/Rollup bundles each entry independently — a kassa build
  never pulls in admin-only code, with zero extra configuration. Verified
  during setup: a minimal test `kassa` entry that only imported `Button`
  produced a 0.36 kB page-specific bundle referencing none of admin's
  ~88 kB sidebar/card chunk; both entries share only what they both
  actually use (React itself, `Button`, base Tailwind styles) via Rollup's
  automatic shared-chunk extraction.
- **Static assets served straight off a Worker's native `ASSETS` binding**
  (`worker/index.ts` is a one-line passthrough), reached only via
  `arcanum-bff`'s `ARCANUM_FRONTENDS_SERVICE` binding — no public route of
  its own.
- **shadcn/ui components are copied source, not an installed package**
  (`npx shadcn@latest add <component>`) — living in `src/components/ui/`,
  shared by every app that imports them. A screen that never imports
  `sidebar` or `card` never ships that code, same as any other import.

## Adding a new screen

1. `mkdir src/apps/<name>` and add `main.tsx` (copy `src/apps/admin/main.tsx`
   as a starting point) + `App.tsx`.
2. Add `<name>.html` at the repo root (copy `admin.html`, update the
   `<script src>` path and `<title>`).
3. Add `'<name>'` to the `APPS` array in `vite.config.ts`.
4. `npx shadcn@latest add <component>` for whatever UI primitives that
   screen actually needs — don't import ones it doesn't.
5. Add a matching route in `arcanum-bff/src/index.ts` (same pattern as
   `/console`'s) pointing at whatever path that screen should live at.

## Structure

```
admin.html                    # one HTML entry per screen
src/
  apps/
    admin/
      App.tsx, main.tsx
      router.tsx             # route tree — every page is React.lazy(),
                              # basepath is /console in production
      components/            # sidebar shell: team-switcher, nav-main,
                              # nav-user, app-sidebar, app-layout
      lib/                   # api.ts (arcanum-bff client), use-async.ts,
                              # theme (light/dark), org-context
      routes/                # one file per page (see Pages below)
  components/ui/             # shadcn/ui components — shared, pulled in per-need
  lib/                       # shared utils (cn(), etc.)
  shared/globals.css         # Tailwind + design tokens, imported by every app
worker/index.ts               # thin ASSETS passthrough — see wrangler.jsonc
```

## Pages (admin app)

- **Dashboard** — reserved space for a real sales-figures view; not implemented.
- **Events** — doesn't exist as a backend concept yet; placeholder.
- **Users** — real member list + invite (`/api/organizations/:orgId/members`).
- **Producten** — categories (what it is, for reports), stations (who
  prepares it: Bar, Keuken, …; optional per product) and products with
  variants. A Groep (where a button sits on the kassa) is set per menukaart.
- **Menukaarten** — catalogs, groups and prices; plus **import/export**: one
  `.xlsx`/`.csv` file = one menukaart, one row = one kassa button (headers
  Groep, Product, Variant, Prijs, Categorie, Station, BTW, Code,
  Snelknoppen, Zichtbaar; Station is optional so older files still import —
  see DOMAIN_MODEL.md in the arcanum folder). The browser only
  finds the header, maps columns and sends raw cells with their sheet row
  numbers (`lib/menu-sheet.ts`); the backend interprets them, previews
  (dry run) and applies all-or-nothing. The spreadsheet libraries
  (read-excel-file / write-excel-file, MIT) live only in `lib/menu-files.ts`,
  loaded with a dynamic `import()` on first export/import.
- **Settings** → Appearance (real, functional light/dark/system toggle),
  Preferences (language — disabled, not supported yet), Profile (real
  `/whoami`), Payment Providers (real, incl. Bancontact prod/preprod),
  Notifications (disabled preview, waiting on the SMTP work), Authentication
  (real OIDC issuer/client config + the org's device-flow link), Gegevens
  (org data export/import, below).
- **Gegevens** (Instellingen) — export all of the org's data as one JSON
  file (secrets only when asked, with a warning), and import such a file as
  a **new** org — also offered from the team switcher's "Nieuwe
  organisatie". The browser drives the import (`lib/org-transfer.ts`):
  start → chunks per table in the server's order (each retried up to 3×;
  chunks are idempotent server-side) → finish, which compares every table's
  count; a mismatch offers retry or abort. An org whose import never
  finished shows a banner (`components/import-banner.tsx`) to resume with
  the same file or cancel. Backend: arcanum-backend `src/org-transfer.ts`.

## Status

Deployed as the `arcanum-frontends` Worker. `arcanum-webapp`'s old
`/admin.html`/`/admin-org.html` pages the admin app replaced are gone, and
every other screen it used to serve (kassa, settings, the customer display,
the SumUp simulator, the org/device chooser) has since moved here too —
`arcanum-webapp` has nothing left to serve. Real data wiring is in — see
`src/apps/admin/lib/api.ts`.

## Local dev

```
npm install
npm run dev       # Vite dev server — proxies /api, /whoami to a local
                   # arcanum-bff (localhost:8787) if one is running, so
                   # real data works without deploying anything first
npm run build     # -> dist/, multi-entry
npx wrangler dev  # serve the built dist/ through the Worker shape
```

## Tests

Every change ships with its tests in the same commit — new behavior gets a
test, a fixed bug gets the test that would have caught it.

```
npm test          # unit tests (Vitest) — fast, no browser; src/**/*.test.ts
npm run test:e2e  # kassa + console E2E (Playwright) — builds, serves dist/ via
                  # `vite preview`, drives Chromium; e2e/*.spec.ts
```

- **Unit** (`src/**/*.test.ts`): pure logic, e.g. `src/apps/kassa/lib.ts`
  (draft merging, totals, breakdown lines, tip math, amount parsing) and
  `src/apps/admin/lib/reports.ts` (report periods, labels). This is the
  layer the deploy gate runs.
- **E2E** (`e2e/`): real screens, real clicks, but **no real backend** —
  `e2e/fake-backend.ts` answers every `/api` call inside the browser
  (`page.route`) and mirrors the backend's rules (amount must equal
  outstanding + tip, one pending payment per tab, closed tabs refuse
  orders, every line from the menukaart, …)
  with the same status codes and messages. So these test *UI behavior*,
  including how the kassa handles a 409; the rules themselves are tested
  against the real implementation in `arcanum-backend`'s own suite. Keep
  the fake in step when the tabs/charges API changes. `push` in
  `e2e/fixtures.ts` sends a devicehub notification to the page. The
  console specs use `e2e/console-fixtures.ts` + `e2e/fake-catalog-admin.ts`
  (catalog rules, a simplified menukaart import/export, plus canned data for
  the Rapporten page).
- Uses Playwright's Chromium from `~/Library/Caches/ms-playwright`; on a
  fresh machine run `npx playwright install chromium` once. On failure,
  `npx playwright show-report` has the trace.

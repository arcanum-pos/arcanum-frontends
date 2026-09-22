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
- **Settings** → Appearance (real, functional light/dark/system toggle),
  Preferences (language — disabled, not supported yet), Profile (real
  `/whoami`), Payment Providers (real, incl. Bancontact prod/preprod),
  Notifications (disabled preview, waiting on the SMTP work), Authentication
  (real OIDC issuer/client config + the org's device-flow link).

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

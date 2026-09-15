# questo-admin

Questo's admin portal, and the eventual home for every other on-screen
interface (kassa, CFD, simulator today; bar, kitchen, self-order, and
whatever else later) — as one Vite project with multiple independent HTML
entry points, not one Worker per screen type.

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
- **Deployed like `questo-webapp` already is**: static assets served
  straight off a Worker's native `ASSETS` binding (`worker/index.ts` is a
  one-line passthrough), reached only via `questo-bff`'s service binding —
  no public route of its own. Same mechanism, just fed by Vite's `dist/`
  instead of Astro's.
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

## Structure

```
admin.html                    # one HTML entry per screen
src/
  apps/
    admin/
      App.tsx, main.tsx
      router.tsx             # route tree — every page is React.lazy()
      components/            # sidebar shell: team-switcher, nav-main,
                              # nav-user, app-sidebar, app-layout
      lib/                   # theme (light/dark), org-context, mock-data
      routes/                # one file per page (see Pages below)
  components/ui/             # shadcn/ui components — shared, pulled in per-need
  lib/                       # shared utils (cn(), etc.)
  shared/globals.css         # Tailwind + design tokens, imported by every app
worker/index.ts               # thin ASSETS passthrough — see wrangler.jsonc
```

## Pages (admin app)

- **Dashboard** — reserved space for a real sales-figures view; not implemented.
- **Events** — doesn't exist as a backend concept yet; placeholder.
- **Users** — member list + invite. Real-looking UI, mock data.
- **Settings** → Appearance (real, functional), Preferences (language,
  disabled — not supported yet), Profile (whoami, mock data), Payment
  Providers (mock data), Notifications (disabled preview, waiting on the
  SMTP work), Authentication (OIDC issuer/client config, mock data).

## Status

Real navigation + routing (TanStack Router), not just a proof-of-shape
shell. Users/Payment Providers/Authentication/Profile run on clearly
labeled mock data in `src/apps/admin/lib/mock-data.ts` — each page has a
TODO comment naming the exact existing `/api/organizations/*` endpoint
(see `webapp/src/lib/organizations.ts`, `worker/src/organizations/`) it
should call once this app has a real session/org context. That needs this
app deployed behind `questo-bff` first — not wired into its routing or
deployed anywhere yet.

## Local dev

```
npm install
npm run dev       # Vite dev server
npm run build     # -> dist/, multi-entry
npx wrangler dev  # serve the built dist/ through the Worker shape
```

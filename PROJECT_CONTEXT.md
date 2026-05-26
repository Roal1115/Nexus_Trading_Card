# PROJECT_CONTEXT.md

> Snapshot generated **2026-05-26**. Read-only audit. Nothing in the codebase was modified to produce this file.

---

## 1. Project Overview

- **Name (display):** Geek Arena (a.k.a. *Geek Collector* in the public header / *National Geek* in the `<head>` title — see ⚠️ below).
- **Purpose:** Public national ranking circuit for competitive TCG players (One Piece, Magic: The Gathering, Pokémon TCG). Store organizers upload tournament results; admins moderate and publish; leaderboards (monthly / semestral / yearly) are recomputed from published tournaments.
- **Target audience:** Mexico-based TCG players, store organizers and circuit administrators (UI copy is Spanish-MX; `country` defaults to `'MX'`).
- **Tech stack (from `package.json`):**
  - React 19, TypeScript 5.8, Vite 7
  - TanStack Start 1.167 + TanStack Router 1.168 (file-based routing, SSR)
  - TanStack React Query 5.83 (provider mounted; not actively used for fetching — see §7)
  - Tailwind CSS 4 (via `@tailwindcss/vite`), `tw-animate-css`, shadcn-style Radix UI components
  - `@supabase/supabase-js` 2.106 — TWO separate projects in use (see §4)
  - `sonner` toasts, `zod` validation, `lucide-react` icons, `react-hook-form` (installed, only used inside shadcn `form.tsx`)
- **Deployment target:** Cloudflare Workers via `@cloudflare/vite-plugin` (see `wrangler.jsonc`, `src/server.ts`).
- **Scripts:** `dev`, `build`, `build:dev`, `preview`, `lint`, `format`.
- ⚠️ **UNCLEAR — branding mismatch:** `__root.tsx` `<title>` is `"National Geek"`, `AppHeader` shows `"GeekCollector"`, panels/login show `"Geek Arena"`. Three product names coexist in code.

---

## 2. Folder & File Structure

```
.
├── PROJECT_CONTEXT.md                ← this file
├── README.md                         (TanStack Start boilerplate readme)
├── package.json, bun.lock, bunfig.toml
├── components.json                   (shadcn config)
├── eslint.config.js, .prettierrc, .prettierignore
├── tsconfig.json, tsconfig.tsbuildinfo
├── vite.config.ts                    (Vite + TanStack + Tailwind + Cloudflare plugins)
├── wrangler.jsonc                    (Cloudflare Worker config)
├── .env                              (only VITE_SUPABASE_* + SUPABASE_URL/PUBLISHABLE_KEY)
├── .lovable/                         (Lovable internals)
├── supabase/
│   ├── config.toml                   (project_id only — Lovable Cloud project)
│   └── migrations/
│       └── 20260526052128_*.sql      (initial schema — see §5 caveat)
└── src/
    ├── server.ts                     (Cloudflare Worker fetch entry, wraps SSR errors)
    ├── start.ts                      (createStart + errorMiddleware)
    ├── router.tsx                    (QueryClient + router factory)
    ├── routeTree.gen.ts              (auto-generated, DO NOT EDIT)
    ├── styles.css                    (Tailwind v4 + design tokens in oklch)
    ├── routes/                       (file-based routes — see §3)
    │   ├── __root.tsx
    │   ├── index.tsx
    │   ├── login.tsx
    │   ├── signup.tsx
    │   ├── check-inbox.tsx
    │   ├── dashboard.tsx
    │   ├── setup.tsx                 (one-off seed for test accounts)
    │   ├── organizer.tsx, organizer.index.tsx, organizer.tournaments.tsx, organizer.new.tsx
    │   └── admin.tsx, admin.index.tsx, admin.approved.tsx, admin.stores.tsx,
    │       admin.publish.tsx, admin.players.tsx, admin.players.$id.tsx
    ├── hooks/
    │   ├── use-geekarena-role.ts     (session + players.role lookup)
    │   ├── use-geekarena-session.ts  (session only, unused — see §11)
    │   └── use-mobile.tsx            (viewport breakpoint hook)
    ├── components/
    │   ├── layout/AppHeader.tsx
    │   ├── layout/PanelSidebar.tsx
    │   └── ui/*                      (47 shadcn primitives — see §6)
    ├── integrations/
    │   ├── geekarena/client.ts                   (REAL backend — hardcoded URL/key)
    │   └── supabase/
    │       ├── client.ts                         (Lovable Cloud browser client — UNUSED at runtime)
    │       ├── client.server.ts                  (Lovable Cloud admin — UNUSED at runtime)
    │       ├── auth-middleware.ts                (Lovable Cloud — UNUSED)
    │       ├── auth-attacher.ts                  (Lovable Cloud — UNUSED)
    │       └── types.ts                          (generated for Lovable Cloud schema)
    └── lib/
        ├── utils.ts                              (cn helper)
        ├── error-capture.ts, error-page.ts      (SSR error page)
        ├── mock-store.tsx                       (🔴 MOCK DATA — see §11)
        ├── geekarena-admin.server.ts            (service-role client factory)
        ├── geekarena-admin.functions.ts         (admin server fns)
        ├── geekarena-organizer.functions.ts    (organizer server fns)
        └── geekarena-setup.functions.ts        (test-account seeder)
```

Conventions:
- Routes live in `src/routes/` using the dot-separated flat convention (`admin.players.$id.tsx`).
- Server functions live in `src/lib/*.functions.ts` with helpers in `*.server.ts`.
- All shadcn primitives live under `src/components/ui/`. Project-specific layout in `src/components/layout/`.
- Hooks in `src/hooks/`. Cross-cutting helpers in `src/lib/`.

---

## 3. Routing & Pages

| Path | File | Renders | Access | Data source |
|---|---|---|---|---|
| `/` | `routes/index.tsx` | National leaderboard hero + two tables (Monthly / Semiannual) | Public | 🔴 MOCK DATA via `useStore()`; only the TCG filter list is real (`games` from GeekArena) |
| `/login` | `routes/login.tsx` | Email/password login, "forgot password", "resend verification" flows | Public (signed-out) | `geekarena.auth.signInWithPassword`, lookup of `players.role` for redirect |
| `/signup` | `routes/signup.tsx` | 3-step wizard: identity → games → confirm; geek_tag uniqueness check; honeypot + min-form-time bot protection | Public | `geekarena.from("games")`, `geekarena.auth.signUp` |
| `/check-inbox` | `routes/check-inbox.tsx` | "Revisa tu correo" screen, resend verification (30s cooldown) | Public (email from `?email=`) | `geekarena.auth.resend` |
| `/dashboard` | `routes/dashboard.tsx` | Player home: national rank, points, recent tournaments | Any signed-in user (mock-store gate) | 🔴 MOCK DATA via `useStore()` |
| `/setup` | `routes/setup.tsx` | One-button seeder for `admin@test.com` + `organizer@test.com` (password `test1234`) | ⚠️ UNCLEAR — route is **publicly reachable**; the `seedTestAccounts` server fn has **no auth check** | `geekarena-setup.functions.ts` → service-role admin client |
| `/organizer` (layout) | `routes/organizer.tsx` | Sidebar shell + `<Outlet/>`; redirects to `/login` unless role is `organizer` or `admin` | organizer / admin | `useGeekarenaRole` |
| `/organizer` (index) | `routes/organizer.index.tsx` | Mi Tienda — pick/assign `home_store_id`, edit store name/city/state | organizer / admin | `getOrganizerOverview`, `updateHomeStore`, `updateStoreInfo` |
| `/organizer/tournaments` | `routes/organizer.tournaments.tsx` | List of tournaments for the organizer's `home_store_id`; delete DRAFTs (confirm modal) | organizer / admin | `getMyTournaments`, `deleteDraftTournament` |
| `/organizer/new` | `routes/organizer.new.tsx` | Create a DRAFT tournament (game + date + optional CSV URL) | organizer / admin | `getOrganizerOverview`, `createTournament` |
| `/admin` (layout) | `routes/admin.tsx` | Sidebar shell; redirects to `/login` unless role is `admin` | admin | `useGeekarenaRole` |
| `/admin` (index) | `routes/admin.index.tsx` | Pending tournaments queue (status = `DRAFT`); approve / reject (confirm modal) | admin | `listTournamentsByStatus`, `approveTournament`, `rejectTournament` |
| `/admin/approved` | `routes/admin.approved.tsx` | Approved tournaments; multi-select + bulk publish (confirm modal) | admin | `listTournamentsByStatus`, `publishTournaments` |
| `/admin/stores` | `routes/admin.stores.tsx` | Store cards w/ organizers; "Nueva tienda" dialog | admin | `listStoresWithOrganizers`, `createStore` |
| `/admin/players` | `routes/admin.players.tsx` | Server-side searchable, filtered, paginated player table (25/page); tabs Todos / Organizadores / Administradores; modal-gated role / store / active toggles | admin | `listPlayers`, `setPlayerRole`, `setPlayerActive`, `listStoresWithOrganizers` |
| `/admin/players/$id` | `routes/admin.players.$id.tsx` | Player profile: store, cumulative stats, tournament history, yearly snapshots | admin | `getPlayerDetail` |
| `*` (any) | `__root.tsx` `notFoundComponent` | 404 page (English copy ⚠️) | Public | — |

**Route guards / redirects**
- `admin.tsx` and `organizer.tsx` run a client `useEffect` on `useGeekarenaRole()`. If `loading === false` and role is wrong, they `navigate({ to: "/login" })`. Both render a spinner while loading and `return null` after redirect to avoid flashing children.
- `/login` redirect tree after successful sign-in: `admin → /admin`, `organizer → /organizer`, anyone else → `/dashboard`.
- `AppHeader` "Mi Panel" link is computed by `homeRouteForRole(effectiveRole)` (`admin → /admin`, `organizer → /organizer`, else `/dashboard`).
- The root layout (`__root.tsx`) hides `<AppHeader/>` when `pathname` starts with `/admin` or `/organizer` (panels use their own `PanelSidebar`).
- ⚠️ UNCLEAR: There is **no server-side / route-loader guard** for `/admin/*` or `/organizer/*`. Authorization runs only in the client `useEffect`; the server functions themselves enforce role via `requireAdmin` / `requireOrganizer` checks on `email`, so a determined caller could still hit a server fn with someone else's email — see §11.

---

## 4. Authentication & Role System

- **Auth provider:** Supabase Auth on the **GeekArena Supabase project** (`https://tbtyxtigbsljyrwyelqr.supabase.co`), instantiated in `src/integrations/geekarena/client.ts` with the publishable key hardcoded in source and `storageKey: "geekarena.auth"` (localStorage).
- **Sign-up flow:**
  1. `/signup` validates geek_tag against `players.geek_tag` via debounced `.ilike` lookup.
  2. Calls `geekarena.auth.signUp({ email, password, options.data: { geek_tag, game_ids[] } })` with `emailRedirectTo: ${origin}/login`.
  3. Signs the user out and routes to `/check-inbox?email=...`.
  4. ⚠️ UNCLEAR / 🚧 INCOMPLETE: A `players` row is **never** inserted at signup. The app reads `players.role` to dispatch the user, so users who only confirmed their email but were not also inserted into `players` get treated as `null` role (i.e. the `/dashboard` fallback). The test-account seeder (`/setup`) is the only path that upserts `players` for known accounts.
- **Sign-in flow (`/login`):** `signInWithPassword`, then a follow-up `.from("players").select("role")` keyed by `email` to choose the redirect target. Also calls `storeLogin(email, "player", geekTag)` on the in-memory mock store so the `AppHeader` shows the user.
- **Sign-out:** `geekarena.auth.signOut()` from `PanelSidebar` (panels) or from `useStore().logout()` triggered in `AppHeader` (which only clears the mock store, **does not call Supabase signOut** — ⚠️).
- **Session management:**
  - `useGeekarenaSession` (unused) and `useGeekarenaRole` (used everywhere) wrap `geekarena.auth.getSession()` + `onAuthStateChange`.
  - The Supabase client persists the session in `localStorage` under `geekarena.auth`.
  - There is **no global `onAuthStateChange` listener** at the root that invalidates React Query / router caches.
- **Roles:** Stored in `players.role` (`'player' | 'organizer' | 'admin'`).
  - 🔴 The role column is **not in the initial migration** (`supabase/migrations/20260526052128_*.sql` defines `players` without `role`) and is **not in the generated `src/integrations/supabase/types.ts`** either. Both server fns and the role hook read/write it. It must exist in the live GeekArena project via an out-of-band migration. ⚠️ UNCLEAR: the source-of-truth schema migration for `role` is **not in the repo**.
  - There is **no `user_roles` table and no `has_role()` SQL function**. Roles are stored on the same row as the profile, contrary to the security guidance in the project rules.
- **Auth checks on server functions:**
  - `requireAdmin(email)` and `requireOrganizer(email)` in `geekarena-admin.functions.ts` / `geekarena-organizer.functions.ts` re-fetch `players` by `email` and assert role.
  - ⚠️ The caller's email is sent in the **request body** rather than derived from a verified session/JWT. No `requireSupabaseAuth` middleware is in use. A request with a known admin's email would be accepted by the server fn. This is a real authorization weakness — flagging only, not fixing.

---

## 5. Database Schema (as currently implemented)

> Source of truth used below: the live database introspection. The repo migration (`supabase/migrations/20260526052128_*.sql`) defines the **initial** schema; subsequent schema changes (notably `players.role` and a `tournament_results.draws` column that the legacy upload UI assumed) are **not present in the repo**.

### Enums
- `public.tournament_status`: `'DRAFT' | 'APPROVED' | 'PUBLISHED'`
  - 🔴 `rejectTournament` server fn writes `status = 'REJECTED'` which is **not** a valid enum value → calling it will throw a Postgres error. The `/organizer/tournaments` UI also displays `PENDING_REVIEW` and `REJECTED` labels that no code path can ever produce. (See §11.)
- `public.timeframe_type`: `'MONTHLY' | 'SEMESTRAL'`
  - 🔴 The publish server fn writes `'MONTH' | 'SEMESTER' | 'YEAR'` strings instead. None of these match the enum, so `recomputeSnapshot` insertions of `leaderboard_snapshots` will fail on the live DB. (See §11.)

### Tables

**`stores`**
- `id uuid PK default gen_random_uuid()`
- `slug varchar(80) UNIQUE NOT NULL`
- `name varchar(150) NOT NULL`
- `city varchar(100)`, `state varchar(100)`
- `country char(2) DEFAULT 'MX'`
- `is_active boolean DEFAULT true`
- `created_at timestamptz DEFAULT now()`

**`games`**
- `id uuid PK`
- `slug varchar(60) UNIQUE NOT NULL`
- `name varchar(100) NOT NULL`
- `publisher varchar(100)`, `logo_url text`
- `is_active boolean DEFAULT true`

**`players`**
- `id uuid PK`
- `geek_tag varchar(30) UNIQUE NOT NULL`
- `display_name varchar(80)`
- `email varchar(255) UNIQUE`
- `avatar_url text`
- `home_store_id uuid → stores(id) ON DELETE SET NULL`
- `is_active boolean DEFAULT true`
- `created_at timestamptz DEFAULT now()`
- ⚠️ `role` — used everywhere in code, **not in introspection, not in repo migration**. Assume `text` / `varchar`. Required values: `'player' | 'organizer' | 'admin'`.

**`tournaments`**
- `id uuid PK`
- `store_id uuid NOT NULL → stores(id)`
- `game_id uuid NOT NULL → games(id)`
- `tournament_date date NOT NULL`
- `qualifying_month smallint NOT NULL` (1..12 CHECK)
- `qualifying_semester smallint NOT NULL` (1 or 2 CHECK)
- `qualifying_year smallint NOT NULL`
- `status tournament_status DEFAULT 'DRAFT'`
- `csv_url text`
- `approved_at timestamptz`, `undo_deadline timestamptz`, `published_at timestamptz`
- `created_at timestamptz DEFAULT now()`
- 🚧 INCOMPLETE: `undo_deadline` is in the schema but **never written or read** anywhere in code.

**`tournament_results`**
- `id uuid PK`
- `tournament_id uuid NOT NULL → tournaments(id) ON DELETE CASCADE`
- `player_id uuid NOT NULL → players(id)`
- `rank smallint NOT NULL`
- `wins smallint DEFAULT 0`, `losses smallint DEFAULT 0`
- `points_earned smallint DEFAULT 0` (0..100 CHECK)
- `UNIQUE (tournament_id, player_id)`
- 🚧 INCOMPLETE: no row is ever inserted from the app. There is **no CSV parser** anywhere in the codebase; `createTournament` only stores a `csv_url`.

**`leaderboard_snapshots`**
- `id uuid PK`
- `player_id uuid NOT NULL → players(id) ON DELETE CASCADE`
- `game_id uuid NOT NULL → games(id) ON DELETE CASCADE`
- `store_id uuid → stores(id)` (nullable; "global" snapshots leave it null)
- `timeframe_type timeframe_type NOT NULL` — enum `MONTHLY` / `SEMESTRAL` only
- `timeframe_value varchar(10) NOT NULL`
- `total_points int DEFAULT 0`
- `tournaments_played smallint DEFAULT 0`
- `tournaments_won smallint DEFAULT 0`
- `rank_position int`
- `last_updated_at timestamptz DEFAULT now()`
- `UNIQUE (player_id, game_id, store_id, timeframe_type, timeframe_value)`

### Indexes
- `idx_tournaments_status (status)`
- `idx_tournaments_year_month (qualifying_year, qualifying_month)`
- `idx_tournaments_year_sem (qualifying_year, qualifying_semester)`
- `idx_lb_query (game_id, store_id, timeframe_type, timeframe_value, total_points DESC)`

### RLS, policies, triggers, functions

- Every table has `ENABLE ROW LEVEL SECURITY` in the migration, but **no `CREATE POLICY` statements exist** — neither in the repo nor exposed in introspection.
- 🔴 Combined with the missing `GRANT` statements (the migration also omits `GRANT … TO authenticated/anon`), only the server fns running with the **service-role key** can read/write. The browser client (`geekarena`) is used to:
  - Read `games` on `/` and `/signup` (this works only because RLS is enabled with no policies → public reads will return zero rows unless `anon`/`authenticated` were granted out-of-band).
  - Probe `players.geek_tag` for uniqueness during signup.
  - Read `players.role` after login. ⚠️ UNCLEAR whether these reads succeed in production depends on policies that are not in the repo.
- **No triggers**, **no functions** in the database (per introspection).
- **No `cron`/`pg_cron`** jobs (per introspection).
- **No storage buckets** in the project.

---

## 6. Component Inventory

### Project-specific layout components

| Component | File | Purpose | Props |
|---|---|---|---|
| `AppHeader` | `components/layout/AppHeader.tsx` | Top nav shown on public pages and dashboard. Logo, role-aware nav (`Ranking`, `Mi Panel`, `Subir Resultados`, `Moderación`), session pill, login/logout button. | none |
| `PanelSidebar` | `components/layout/PanelSidebar.tsx` | Left sidebar for `/admin` and `/organizer`. Items, active-state highlight, logout button (calls `geekarena.auth.signOut`). | `title`, `subtitle`, `items: SidebarItem[]`, `userLabel` |
| `NavItem` (local) | inside `AppHeader.tsx` | Single nav link with active/inactive styling. | `to`, `icon`, `label` |
| `Field`, `Stepper`, `Step1`, `Step2`, `Step3`, `TagBadge` (local) | inside `routes/signup.tsx` | 3-step wizard sub-components. | various |
| `FieldLabel` (local) | (was inside the removed `routes/upload.tsx`) — no longer present | — | — |
| `LeaderboardTable`, `Select`, `TicketBadge` (local) | inside `routes/index.tsx` | Public ranking presentation pieces. | various |
| `RowActions` (local) | inside `routes/admin.players.tsx` | Per-row dropdown of admin actions on a player. | `p`, `onChangeRole`, `onAssignStore`, `onToggleActive` |

### Shared UI primitives (`src/components/ui/`) — shadcn

47 files: `accordion, alert-dialog, alert, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input-otp, input, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toggle-group, toggle, tooltip`.

Primitives actively imported by routes:
- `button`, `input`, `label`, `select`, `dialog`, `alert-dialog`, `badge`, `checkbox`, `dropdown-menu`, `tooltip` (used across `/admin/*` and `/organizer/*`).
- `sonner` is mounted implicitly via `toast` imports (Note: a `<Toaster/>` provider is **not** rendered anywhere — toasts may not appear. ⚠️ UNCLEAR / 🚧).

Many shadcn primitives (`carousel`, `chart`, `command`, `drawer`, `pagination`, `resizable`, `sidebar`, `menubar`, `navigation-menu`, `input-otp`, etc.) are present but **not imported** anywhere in the application code.

---

## 7. State Management

- **Global state (in-memory React Context):** `AppStoreProvider` from `src/lib/mock-store.tsx` is mounted in `__root.tsx`. It holds:
  - `currentUser` (persisted to `localStorage` under `geek-collector-user`)
  - `players` (🔴 seeded from `TAGS`/`CITIES` arrays at module load)
  - `tournaments` (🔴 seeded mock data)
  - `pendingSubmissions` (🔴 seeded mock data)
  - Mutations: `login`, `signup`, `logout`, `loginAsDemo`, `submitTournament`, `approveSubmission`, `declineSubmission` — all purely in-memory.
- **Auth state:** kept in component state via `useGeekarenaRole()` (re-fetched on `onAuthStateChange`). Not in a global store; each consumer subscribes independently and refetches `players` on mount.
- **Server data:** Each route component owns its own `useEffect` + `useState` + `useServerFn(...)` pattern (e.g. `/admin/players`, `/admin/index`, `/organizer/new`). 🚧 React Query is installed and the provider is mounted, but **no `useQuery` / `useSuspenseQuery` / `ensureQueryData` calls exist** outside the shadcn `chart` file. There is no caching layer; every navigation refetches.
- **Local UI state:** Standard `useState` / `useMemo` / `useRef` per component (filters, debounce timers, modal targets, etc.).

---

## 8. Business Logic

### 8.1 Tournament upload flow (DRAFT → APPROVED → PUBLISHED)

1. **Create draft** — `/organizer/new` → `createTournament` server fn
   - Inputs: `email`, `game_id` (uuid), `tournament_date` (YYYY-MM-DD), optional `csv_url` (must start with `http(s)://`).
   - Computes `qualifying_month`, `qualifying_semester` (`<=6 ⇒ 1` else 2), `qualifying_year` from `tournament_date`.
   - Inserts into `tournaments` with `status: 'DRAFT'`, returns `{ id }`.
   - ⚠️ The CSV file is **not parsed**; only the URL is stored. No rows go into `tournament_results`.

2. **Moderation** — `/admin` → `approveTournament` / `rejectTournament` server fns
   - `approveTournament`: sets `status = 'APPROVED'`, `approved_at = now()`.
   - `rejectTournament`: 🔴 tries to set `status = 'REJECTED'` — invalid enum value → DB error.

3. **Publish** — `/admin/approved` → `publishTournaments` server fn
   - Filters the selected ids to those whose current `status` is `'APPROVED'` or `'DRAFT'`.
   - Updates `status = 'PUBLISHED'`, `published_at = now()`, `approved_at = now()`.
   - Then iterates one `(game_id, timeframe_type, timeframe_value)` slice at a time, calling `recomputeSnapshot` (see §8.3).
   - 🔴 `recomputeSnapshot` writes `timeframe_type` values `'MONTH'`, `'SEMESTER'`, `'YEAR'`, but the DB enum only accepts `'MONTHLY'` and `'SEMESTRAL'` — every insert is expected to fail. There is no `'YEAR'` enum value at all.

### 8.2 Undo window (48h)

🚧 INCOMPLETE — `tournaments.undo_deadline` exists as a column but no code writes it, reads it, or implements an "undo publish" action. No cron / scheduled job present.

### 8.3 Leaderboard recompute (`recomputeSnapshot`)

For a `(game_id, timeframe_type, timeframe_value)` slice:
1. Fetch all PUBLISHED `tournaments` for that `game_id` filtered by `(year[, month][, semester])`.
2. Delete existing `leaderboard_snapshots` rows in that slice.
3. Sum `points_earned`, count `tournaments_played`, count `rank === 1` as wins per `player_id` across `tournament_results`.
4. Sort by `total_points DESC`, assign `rank_position = i + 1`, bulk insert into `leaderboard_snapshots`.

Triggers: only invoked from `publishTournaments`. There is no scheduled recomputation, no on-result-insert trigger.

### 8.4 Dual leaderboard system (MONTHLY vs SEMESTRAL, store vs global)

- The schema supports it: `leaderboard_snapshots` has `timeframe_type`, `timeframe_value`, and a nullable `store_id` for "global vs store".
- 🔴 The current `recomputeSnapshot` implementation never sets `store_id`, always writes `null`. There is **no store-scoped snapshot generation** anywhere.
- The public leaderboard at `/` does **not query `leaderboard_snapshots` at all** — it renders mock players from `useStore()`. The dual-leaderboard UI on `/` shows hard-coded `MONTHS` (`["Mayo 2026", "Abril 2026", ...]`) and a fake `"S1 2026"` header.

### 8.5 Cron jobs

None. No `pg_cron`, no scheduled workers, no `/api/public/*` cron endpoints, no `supabase/functions/*`.

---

## 9. Admin Panel (`/admin`)

Sidebar (defined in `routes/admin.tsx`):
- `Torneos Pendientes` → `/admin`
- `Torneos Aprobados` → `/admin/approved`
- `Tiendas y Organizadores` → `/admin/stores`
- `Jugadores` → `/admin/players`
- `Publicar Manualmente` → `/admin/publish`

### `/admin` — Pending tournaments
- Lists tournaments with `status IN ('DRAFT')` (despite the section calling itself "Pendientes").
- Actions: **Aprobar** (instant), **Rechazar** (alert-dialog confirm, 🔴 invalid enum).
- Server fns: `listTournamentsByStatus({ statuses: ['DRAFT'] })`, `approveTournament`, `rejectTournament`.

### `/admin/approved` — Approved tournaments
- Lists `status = 'APPROVED'`.
- Multi-select checkboxes, top "Publicar seleccionados (n)" button with confirm dialog.
- Server fns: `listTournamentsByStatus({ statuses: ['APPROVED'] })`, `publishTournaments`.

### `/admin/stores` — Tiendas y Organizadores
- Loads all stores + all `players` whose `role IN ('organizer','admin')`.
- Renders one card per store with its organizers grouped by `home_store_id`.
- "Nueva tienda" dialog inserts a new `stores` row (slug + name + city + state, hardcoded `country = 'MX'`).
- Server fns: `listStoresWithOrganizers`, `createStore`.

### `/admin/players` — Jugadores (server-side at scale)
- Tabs: **Todos**, **Organizadores**, **Administradores**. Tab forces `role` filter.
- Filters: Rol, Estado (`is_active`), Tienda, Ordenar por (`recent | geek_tag | points`).
- Search: 400ms debounce; if input contains `@` it `.ilike` searches `email`, otherwise `geek_tag`. Special chars `% , ( )` are stripped.
- Pagination: 25/page server-side using `.range(from, to)` with `count: 'exact'`.
- Sort by `points`: precomputes ordered player ids from `leaderboard_snapshots` `timeframe_type='YEAR'` (🔴 enum mismatch — see §5), takes the page slice, queries `.in('id', idsForPage)`, reorders client-side.
- Actions per row (all gated by confirmation modals):
  - **Cambiar rol** → `setPlayerRole`
  - **Asignar tienda** (visible only on `organizers` tab) → `setPlayerRole` with `home_store_id`
  - **Activar / Desactivar cuenta** → `setPlayerActive`
  - **Ver perfil** → navigates to `/admin/players/$id`
- Admins tab additionally requests `include_last_sign_in: true`, which calls Supabase Admin `auth.admin.listUsers({ page:1, perPage:1 })` per row and pulls `last_sign_in_at`. ⚠️ This `perPage:1` is incorrect — only the first auth user is fetched and then `.find(email===…)` is applied → the column will almost always be `—`.
- Server fns: `listPlayers`, `setPlayerRole`, `setPlayerActive`, `listStoresWithOrganizers`.

### `/admin/players/$id` — Player profile
- Loads cumulative stats from `tournament_results` (sum of `points_earned`, count of `rank === 1`), the assigned store, and yearly `leaderboard_snapshots`.
- Shows the tournament history list (date / rank / W-L / points) and yearly ranks.
- Server fn: `getPlayerDetail`.

### `/admin/publish` — Publicar Manualmente
- 🚧 Effectively a redirect page: it only contains a link to `/admin/approved`. No standalone functionality.

---

## 10. Organizer Panel (`/organizer`)

Sidebar (defined in `routes/organizer.tsx`):
- `Mi Tienda` → `/organizer`
- `Mis Torneos` → `/organizer/tournaments`
- `Subir Torneo` → `/organizer/new`

### `/organizer` — Mi Tienda
- Loads `getOrganizerOverview` → `stores`, active `games`, current `homeStore`.
- "Asignar" → updates `players.home_store_id` (`updateHomeStore`).
- If `homeStore` is set, second card with editable `name / city / state` → `updateStoreInfo` (enforces "you can only edit your assigned store unless admin").

### `/organizer/tournaments` — Mis Torneos
- Lists `tournaments WHERE store_id = player.home_store_id` (empty if not assigned).
- DRAFT-only row action: **Eliminar** (confirm dialog) → `deleteDraftTournament`.
- Status labels render Spanish translations for `DRAFT / PENDING_REVIEW / APPROVED / PUBLISHED / REJECTED`. 🔴 `PENDING_REVIEW` and `REJECTED` are never produced by the rest of the app.

### `/organizer/new` — Subir Torneo
- Loads `getOrganizerOverview` (needs store + active games).
- If no `home_store_id`, shows "Primero debes asignar una tienda".
- Form: TCG (select), Fecha (date), URL del CSV (optional, `http(s)://`).
- Displays computed `mes / semestre / año` preview.
- Submits → `createTournament`, navigates to `/organizer/tournaments`.

---

## 11. Known Issues & Incomplete Features

### 🔴 MOCK DATA (still wired)
- `src/lib/mock-store.tsx` — entire 40-row leaderboard, tournament history, pending submissions, demo logins. Mounted globally.
- `routes/index.tsx` — public leaderboard is 100% mock; only the TCG filter dropdown is real.
- `routes/dashboard.tsx` — player dashboard is 100% mock (stats, rank, recent tournaments). All copy in English ⚠️.
- `routes/index.tsx` — `MONTHS = ["Mayo 2026", ..., "Febrero 2026"]` hardcoded.
- `routes/check-inbox.tsx`, `routes/login.tsx`, `routes/signup.tsx` use the real backend; the rest of the app does not consistently.

### 🔴 Schema / enum bugs (will fail at runtime against the live DB)
- `rejectTournament` writes `status = 'REJECTED'`, not in `tournament_status` enum.
- `recomputeSnapshot` (called by `publishTournaments`) writes `timeframe_type` values `'MONTH' | 'SEMESTER' | 'YEAR'`; the enum is `'MONTHLY' | 'SEMESTRAL'` with no yearly variant. Every snapshot insert is expected to fail → leaderboards never populate.
- `listPlayers` `sort='points'` reads `leaderboard_snapshots WHERE timeframe_type='YEAR'` — same enum mismatch, so this sort returns zero ids.
- `players.role` is read/written everywhere but is missing from both the repo migration and `src/integrations/supabase/types.ts`. The live DB presumably has it but the schema-as-code is out of sync.

### 🚧 INCOMPLETE features
- **CSV ingestion:** No CSV parser. Tournaments only store a URL; `tournament_results` rows are never inserted. The whole leaderboard pipeline is therefore inert even before the enum bugs.
- **Players auto-provisioning:** `signUp` does not insert into `players`. New users will land with `role = null` → `/dashboard` (mock).
- **Undo publish (48h):** Column exists, no logic.
- **Cron / scheduled snapshot refresh:** Not implemented anywhere.
- **Per-store leaderboards:** `recomputeSnapshot` never sets `store_id`.
- **`/admin/publish` page:** Placeholder only; redirects user back to `/admin/approved`.
- **`<Toaster/>` provider:** `sonner` toasts are called all over the app but the provider is not mounted in `__root.tsx`.
- **React Query usage:** Provider is mounted; no queries are actually defined. All fetching is `useEffect` + `useState`.
- **Auth state invalidation:** No global `onAuthStateChange` listener that invalidates router/query state.
- **`useGeekarenaSession` hook:** defined but never imported.

### ⚠️ UNCLEAR / risk
- Product branding splits across `Geek Arena / GeekCollector / National Geek`.
- `/setup` is a publicly reachable route and `seedTestAccounts` has no auth gate — anyone can reset the passwords on the canonical test accounts at any time.
- Server fns take the user's `email` as a body parameter and re-fetch `players` from it. There is no proof the caller is that user (no `requireSupabaseAuth` middleware, no JWT validation). Authorization is effectively trust-based on the email field.
- `admin.players.tsx` line ~409 references `<Users />` icon in JSX without importing `Users` from `lucide-react`. Will throw a `Users is not defined` ReferenceError when the empty-state branch renders.
- `admin.players.tsx` `setRole`/`setPlayerActive`/etc. casts use `as any` in several places.
- The Lovable Cloud Supabase client files (`src/integrations/supabase/{client,client.server,auth-middleware,auth-attacher,types}.ts`) are wired by the platform but **not used** at runtime — all traffic goes to the hardcoded `tbtyxtigbsljyrwyelqr` GeekArena project.
- `__root.tsx` `og:image` points to a `pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev` URL from an earlier project preview deploy. Should likely be replaced before publish.
- 404 page (`__root.tsx`) is in English ("Page not found", "Go home", "Try again") — conflicts with the Spanish-MX language rule for the rest of the UI.
- No TODO/FIXME/HACK/XXX comments were found in the codebase.

---

## 12. Environment Variables

From `.env` (names only):

| Variable | Scope | Required? | Used for |
|---|---|---|---|
| `VITE_SUPABASE_URL` | client (build-time) | optional (unused at runtime) | Lovable Cloud browser client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client | optional (unused at runtime) | Lovable Cloud browser client |
| `VITE_SUPABASE_PROJECT_ID` | client | optional | Lovable Cloud project id |
| `SUPABASE_URL` | server | optional (unused at runtime) | Lovable Cloud server client |
| `SUPABASE_PUBLISHABLE_KEY` | server | optional (unused at runtime) | Lovable Cloud server client |

Lovable-managed secrets (not in `.env`, fetched from the secrets store):

| Secret | Scope | Required? | Used for |
|---|---|---|---|
| `GEEKARENA_SERVICE_ROLE_KEY` | server | **REQUIRED** | All admin / organizer server fns (`getGeekarenaAdmin`). App breaks at runtime without it. |
| `SUPABASE_SERVICE_ROLE_KEY` | server | optional (unused) | Lovable Cloud admin client |
| `SUPABASE_DB_URL` | server | optional (unused) | — |
| `LOVABLE_API_KEY` | server | optional (unused) | Lovable AI Gateway (no AI calls in code) |

Note: the **real backend URL** (`https://tbtyxtigbsljyrwyelqr.supabase.co`) and the **publishable key** for that project are **hardcoded** in `src/integrations/geekarena/client.ts` and `src/lib/geekarena-admin.server.ts`. They are not configured via env vars.

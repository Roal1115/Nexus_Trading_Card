# PROJECT_CONTEXT.md

> Snapshot generated **2026-07-03**. Read-only audit. Nothing in the codebase was modified to produce this file. Supersedes the 2026-05-26 snapshot, which is ~1,238 commits stale — the app has grown from a 5-page MVP into a 4-role, ~45-route platform.

---

## 1. Project Overview

- **Name (display):** Nexus (`<title>`/`og:title`/`twitter:title` in `__root.tsx` now consistently read "Nexus" — the "National Geek" branding mismatch from the old snapshot was fixed 2026-07-03).
- **Purpose:** National ranking circuit for competitive TCG players (One Piece, Magic: The Gathering, Pokémon TCG) in Mexico. Store organizers upload tournament results, TCG managers moderate per-store submissions, admins run the whole circuit (seasons, publishing, ads, players). A separate "Sessions" feature lets players log round-by-round match history outside of official tournaments (casual play or auto-linked to a tournament).
- **Tech stack (from `package.json`):**
  - React 19, TypeScript 5.8, Vite 7
  - TanStack Start 1.167 + TanStack Router 1.168 (file-based routing, SSR)
  - Data caching: a hand-rolled in-memory TTL cache (`src/lib/query-cache.ts`). (`@tanstack/react-query`'s provider was removed 2026-07-03 — it was mounted app-wide with zero `useQuery`/`useMutation` call sites; the package itself is still a dependency but no longer wired into the router/root.)
  - Tailwind CSS 4, Radix UI primitives via shadcn-style components, `framer-motion`, `recharts`, `embla-carousel-react`
  - `@supabase/supabase-js` 2.106 — two client setups exist; only one is actually used (see §4)
  - `read-excel-file` / `xlsx` — new since last snapshot, used for tournament result uploads
  - `sonner` toasts, `zod` + `react-hook-form` + `@hookform/resolvers` for forms
- **Deployment target:** Cloudflare Workers via `@cloudflare/vite-plugin` (`wrangler.jsonc`, `src/server.ts`), `compatibility_date: 2025-09-24`, `nodejs_compat` on.
- **Scripts:** `dev`, `build`, `build:dev`, `preview`, `lint`, `format`.

---

## 2. Folder & File Structure

```
.
├── PROJECT_CONTEXT.md
├── README.md
├── .env                               (gitignored and untracked as of 2026-07-03; still exists locally with live credentials — see §12)
├── supabase/
│   ├── config.toml                    (project_id = tbanxcysqureaafohusj)
│   ├── functions/
│   │   └── sync-deck-identifiers/     (edge function — see §8.4; NOT invoked anywhere)
│   └── migrations/
│       └── 20260526052128_*.sql       (single migration, badly out of date — see §5)
└── src/
    ├── server.ts, start.ts, router.tsx, routeTree.gen.ts (auto-gen), styles.css
    ├── context/
    │   └── nexus-auth.context.tsx (central auth provider, replaces the old useNexusRole hook)
    ├── routes/                        (~45 files — see §3)
    ├── hooks/
    ├── components/
    │   ├── layout/          AppHeader.tsx, PanelSidebar.tsx
    │   ├── admin/            StoreSchedulesDialog.tsx, UnapproveTournamentDialog.tsx
    │   ├── ads/               AdVertical.tsx, AdHorizontal.tsx, AdCarousel.tsx
    │   ├── stores/            StoreEditModal.tsx
    │   ├── tournament-tracker/ PerformanceTrackerModal.tsx, RoundsAccordionReadOnly.tsx, AppealForm.tsx
    │   ├── upload/            TournamentUploadForm.tsx
    │   └── ui/                shadcn primitives + custom (skeleton-loader, FileLink, NotificationBadge, PasswordStrength)
    ├── integrations/
    │   ├── nexus/client.ts        (REAL backend client — actively used, 11 imports)
    │   └── (supabase/* scaffold removed 2026-07-03 — see §4)
    └── lib/
        ├── query-cache.ts                        (custom TTL Map cache — new)
        ├── nexus-admin.functions.ts           (tournament approval, seasons, admin history)
        ├── nexus-admin.server.ts
        ├── nexus-ads.functions.ts             (sponsors / ad system)
        ├── nexus-appeals.functions.ts         (round appeals)
        ├── nexus-auth.functions.ts             (signupPlayer)
        ├── nexus-auth-helpers.functions.ts    (profile/email/password/tcg-id updates)
        ├── nexus-auth.middleware.ts, nexus-auth.attacher.ts
        ├── nexus-leaderboard.functions.ts
        ├── nexus-manager.functions.ts         (TCG manager approval flow)
        ├── nexus-organizer.functions.ts       (store organizer flow)
        ├── nexus-player.functions.ts          (dashboard, deck identifiers, profile)
        ├── nexus-public.functions.ts          (public store directory)
        ├── nexus-settings.functions.ts
        ├── nexus-setup.functions.ts           (seedTestAccounts, searchStores)
        ├── nexus-standalone.functions.ts      (Sessions feature — see §8.5)
        ├── nexus-tournament-detail.server.ts
        └── nexus-tournament-tracker.functions.ts
```

---

## 3. Routing & Roles

Four roles now exist: `player | organizer | tcg_manager | admin` (up from three). Three parallel panel layouts, each with its own sidebar and role gate in a client `useEffect`:

| Panel | Base route | Role gate | Sidebar sections |
|---|---|---|---|
| **Admin** | `/admin` | `role === "admin"` only | Administración (Tournaments, Tournament History, Stores & Staff, Players, Seasons, Activity Center), Circuito (Manual Publish, National Calendar, Upload Tournament), Publicidad (Sponsors & Ads) |
| **TCG Manager** | `/tcg-manager` | `role === "tcg_manager"` or `"admin"` | Moderación (Tournaments, Tournament History, My History), Red (Stores), Circuito (Analytics, Calendar, Upload Tournament) |
| **Organizer** | `/organizer` | `role === "organizer"` or `"admin"` | Analytics, My Store, My Tournaments, Tournament History, Calendar, Upload Tournament, Appeals |

TCG Manager is a **subset of Admin** scoped to tournament moderation + store network for the games a manager is assigned to (`assignManagerGames`) — it is not a renamed admin panel, both coexist and admins can reach either.

### Public / player routes

| Path | Purpose | Data source |
|---|---|---|
| `/` | Live leaderboard, virtual list, search, sponsor ad carousel | `getLeaderboard`, `getLeaderboardOptions`, ad functions — **real data now**, no longer mock |
| `/dashboard` | Player home: geek tag, global/monthly rank, W-L, points, tournament history, "Mis Sesiones" link | `getMyDashboard`, `getTournamentDetail` |
| `/players/$playerTag` | Public profile (SEO schema.org), gated by `is_profile_public` | `getPlayerProfile` |
| `/stores`, `/stores/$slug` | Store directory + detail | `getPublicStoresList`, `getStoreProfile`, `getStoreWeeklySchedule` |
| `/my-stats`, `/settings` | Player stats and account settings | `nexus-settings.functions.ts` |
| `/login`, `/signup`, `/check-inbox`, `/reset-password` | Auth flows | `nexus-auth.functions.ts` |
| `/setup` | Test-account seeder | `seedTestAccounts` — ⚠️ still worth confirming this is auth-gated in production |

### Sessions feature (new, `/sessions`)

Standalone round-by-round match tracker, separate from official tournament results:

- **`/sessions`** — list of the player's sessions (`getStandaloneSessions`), status badges: unlinked / matched / casual. Create via 2-step modal (`createStandaloneSession`): **competitive** (date + time + store, auto-links to a published tournament or opens a manual disambiguation picker) or **casual** (date optional, no store/time).
- **`/sessions/$sessionId`** — round-by-round tracker: opponent leader deck, dice roll, turn order, result, notes. Rounds saved/deleted individually (`saveStandaloneRound`, `deleteStandaloneRound`). Manual tournament linking via `getTournamentCandidates` + `linkSessionManually`; `undoSessionLink` reverts a match.
- Leader/deck selection is backed by the `deck_identifiers` table via `getDeckIdentifiers` — see §8.4 for why this data may be stale.

---

## 4. Authentication & Role System

- **Auth provider:** `NexusAuthProvider` (`src/context/nexus-auth.context.tsx`), mounted once in `__root.tsx`. This **replaces** the old per-component `useNexusRole` hook pattern from the previous snapshot — it's now a single context listening to `onAuthStateChange` and exposing `{ session, player, role, loading }` app-wide.
- **Client:** `src/integrations/nexus/client.ts`, pointed at `https://tbtyxtigbsljyrwyelqr.supabase.co` with a publishable key, `storageKey: "nexus.auth"`.
- **Lovable Cloud scaffold removed (2026-07-03):** `src/integrations/supabase/{client,client.server,auth-middleware,auth-attacher,types}.ts` was deleted. It was fully dead except `auth-attacher.ts`'s `attachSupabaseAuth`, which was wired into `src/start.ts`'s global `functionMiddleware` — on every server-function call it fetched a session from the (unused) Lovable client and attached a bearer header that nothing ever verified (`requireSupabaseAuth` in `auth-middleware.ts` was defined but never registered anywhere). That middleware entry was removed from `start.ts` along with the folder. All real traffic goes through `nexus/client.ts`; no behavior change from this removal. If the Lovable platform re-generates this folder on a future sync, it can be deleted again the same way.
- **Redirect on login:** `admin → /admin`, `tcg_manager → /tcg-manager`, `organizer → /organizer`, else `/dashboard`, via `homeRouteForRole()`.

---

## 5. Database Schema — ⚠️ CRITICAL DRIFT

The single migration file (`20260526052128_*.sql`) only defines the original 6 tables (`stores`, `games`, `players`, `tournaments`, `tournament_results`, `leaderboard_snapshots`) with enums `tournament_status (DRAFT/APPROVED/PUBLISHED)` and `timeframe_type (MONTHLY/SEMESTRAL)`.

The application code now reads/writes **at least 15 additional tables that do not exist anywhere in the repo's migration history**:

`admin_audit_log`, `deck_identifiers`, `deck_identifiers_sync_log`, `manager_games`, `player_games`, `player_tcg_ids`, `round_appeals`, `seasons`, `session_link_events`, `sponsors`, `standalone_round_results`, `standalone_sessions`, `store_analytics_settings`, `store_schedules`, `tournament_round_results`, `ad_metrics`

Plus columns missing from the migrated `players`/`tournaments` tables but used in code: `players.auth_user_id`, `players.display_name`, `players.role`, `players.is_profile_public`; `tournaments.rejection_reason`, `tournaments.approved_by`.

**Implication:** `supabase/migrations/` cannot be used to stand up a working copy of the live database. All of this schema exists only in the live Supabase project (`tbanxcysqureaafohusj` per `supabase/config.toml`, or the hardcoded `tbtyxtigbsljyrwyelqr` project in `nexus/client.ts` — confirm these are the same project before relying on either). If you need the real schema, pull it from the live DB (`supabase db pull`) rather than trusting this repo.

**Fixed since last snapshot:** the `rejectTournament` invalid-enum bug is gone — rejection now writes `status = 'DRAFT'` plus a `rejection_reason` text column instead of the non-existent `'REJECTED'` enum value.

---

## 6. Caching

`src/lib/query-cache.ts` — a small hand-rolled in-memory `Map`-based TTL cache (`getCached(key, ttlMs=30000)`, `setCached`, `invalidateCache`). This is new since the last snapshot (which had no caching at all) and is now the **only** caching mechanism in the app — the unused `@tanstack/react-query` `QueryClientProvider` was removed from `router.tsx`/`__root.tsx` on 2026-07-03 (zero `useQuery`/`useMutation` call sites existed). The `@tanstack/react-query` package is still a dependency in case it's reintroduced deliberately, but nothing wires it up today. The TTL cache is process-local and resets on every server restart/deploy, so it has no effect across Cloudflare Worker isolates.

---

## 7. Business Logic Highlights

### 7.1 Tournament lifecycle
`DRAFT → APPROVED → PUBLISHED`, same as before, but moderation now forks by role: TCG managers approve/reject within their assigned games (`nexus-manager.functions.ts`), admins can additionally unapprove/unpublish and force-recompute snapshots (`nexus-admin.functions.ts`). Uploads now go through `TournamentUploadForm.tsx` + `read-excel-file`/`xlsx`, not a bare CSV URL — actual result rows are parsed and inserted (this closes the "CSV never parsed" gap from the old snapshot; verify still worth spot-checking given schema drift).

### 7.2 Seasons
`createSeason`, `activateSeason`, `deactivateSeason`, `listSeasons` — a `seasons` table (not in the migration) now scopes leaderboard periods; this concept didn't exist in the last snapshot.

### 7.3 Sponsors / Ads
Full CRUD (`nexus-ads.functions.ts`) plus view tracking (`registerAdView`, `ad_metrics` table) and carousel/vertical/horizontal placements. New since last snapshot.

### 7.4 Appeals
Players/organizers can dispute a round result (`createAppeal`, `getStoreAppeals`, `resolveAppeal`) — new since last snapshot, tied to `round_appeals` table.

### 7.5 Deck identifiers — feature half-wired
`deck_identifiers` holds leader-card metadata (name, set, colors, image) used by the Sessions round tracker for opponent-leader search (`getDeckIdentifiers`). The only thing that populates this table is the edge function below, and it is never called:

**`supabase/functions/sync-deck-identifiers/index.ts`** — fetches One Piece TCG leader cards from `optcgapi.com` (sets/decks/promos), upserts into `deck_identifiers` (dedup on `game_id+card_image_id+api_source`), soft-deletes stale rows, logs to `deck_identifiers_sync_log`. Hardcoded to the One Piece `game_id`, excludes OP01–OP04. **Grep across `src/` finds zero invocations** — no cron, no admin button, no `functions.invoke("sync-deck-identifiers")` anywhere. Whatever data exists in `deck_identifiers` today was seeded manually or via a one-off run; there's no ongoing refresh path.

---

## 8. Known Issues & Incomplete Features

### Still open

- 🔴 **Schema drift** (see §5) — the repo's migration cannot rebuild the live schema. Fixing this requires the Supabase CLI and a `supabase db pull` against the live project; deferred, needs a deliberate pass with DB access.
- 🔴 **`sync-deck-identifiers` edge function is orphaned** — deck search data has no refresh mechanism. Fixing this requires deciding a trigger (pg_cron schedule vs. a manual admin "sync" button) and deploying via the Supabase CLI; deferred pending that decision.

### Resolved 2026-07-03

- ✅ **Branding mismatch** — root `<title>`/`og:title`/`twitter:title` in `__root.tsx` changed from "National Geek" to "Nexus"; `author` meta changed from "Geek Collector" to "Nexus".
- ✅ **`.env` untracked from git** — was committed despite being gitignored; ran `git rm --cached .env` so it's no longer tracked going forward. Note: this does **not** scrub the credentials already present in git history — rotate the service role key / JWTs in the Supabase dashboard if this repo's history is or becomes shared.
- ✅ **Lovable Cloud Supabase scaffold deleted** — `src/integrations/supabase/*` removed along with its one live wiring point in `src/start.ts` (see §4). Verified via `tsc --noEmit` and a full `vite build` that nothing else referenced it.
- ✅ **Unused React Query provider removed** — `QueryClientProvider`/`QueryClient` construction removed from `router.tsx` and `__root.tsx` (root route no longer needs `createRootRouteWithContext`, uses plain `createRootRoute`). The app's only caching layer is now `query-cache.ts` (see §6).

---

## 9. Environment Variables

From `.env` (names only — do not print values):

`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID`, `NEXUS_SERVICE_ROLE_KEY` (required server-side for all admin/organizer/manager server functions via `getNexusAdmin()`).

`supabase/config.toml` → `project_id = "tbanxcysqureaafohusj"`. Confirm this matches the hardcoded project reference in `src/integrations/nexus/client.ts` (`tbtyxtigbsljyrwyelqr`) — if they differ, one of the two is stale.

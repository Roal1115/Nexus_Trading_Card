# Nexus

A Cloudflare Worker–hosted React application for managing a Mexican national TCG circuit. The app supports players, organizers, TCG managers, and admins for One Piece, Magic: The Gathering, and Pokémon TCG rankings and tournament workflows.

## Project summary

This repository contains a full-stack app built with TanStack Start and deployed to Cloudflare Workers. It’s backed by Supabase (auth + Postgres) with four roles (player, organizer, TCG manager, admin), a live leaderboard, tournament upload/moderation pipeline, and a standalone round-by-round match tracker ("Sessions").

## What’s included

- `src/` — application source code
- `src/routes/` — TanStack Router pages and panel layouts (public, `/organizer`, `/tcg-manager`, `/admin`, `/sessions`)
- `src/components/` — reusable UI, layout, and feature components (ads, tournament-tracker, upload, stores)
- `src/context/` — `NexusAuthProvider`, the app-wide auth/role context
- `src/lib/` — server functions (one file per domain), query cache, error handling
- `src/integrations/nexus/` — the only Supabase client in the app (the legacy, unused Lovable Cloud scaffold that used to live in `src/integrations/supabase/` was removed)
- `supabase/` — project config, edge functions, and the initial migration (⚠️ the live schema has drifted well beyond this migration — see `PROJECT_CONTEXT.md`)
- `wrangler.jsonc` — Cloudflare Workers deployment config
- `vite.config.ts` — Vite + TanStack + Tailwind + Cloudflare plugin config

## Tech stack

- React 19
- TypeScript 5.8
- Vite 7
- TanStack Start 1.167 + TanStack Router 1.168
- Data caching via a custom TTL cache in `src/lib/query-cache.ts` (`@tanstack/react-query` is a dependency but no longer wired into the router/root)
- Tailwind CSS 4, Radix UI primitives via shadcn-style components, `framer-motion`, `recharts`
- `react-hook-form` + `zod` for forms
- `read-excel-file` / `xlsx` for tournament result uploads
- Cloudflare Workers deployment via `@cloudflare/vite-plugin`
- Supabase Auth + Postgres

## Key features

- Live national leaderboard (monthly/semestral, per game and store) with sponsor ad placements
- Player dashboard, public player profiles, and store directory
- Organizer flow: manage home store, upload tournament results, view calendar and appeals
- TCG manager flow: approve/reject tournaments for assigned games, manage store network
- Admin flow: full moderation, seasons, manual publish, players, sponsors/ads, activity log
- Sessions: standalone round-by-round match tracking, auto-linkable to a published tournament or kept casual
- Role-aware navigation for players, organizers, TCG managers, and admins

## Important notes

- See `PROJECT_CONTEXT.md` for a full, up-to-date audit — it covers schema drift, the orphaned `sync-deck-identifiers` edge function, and other open issues in detail.
- The `supabase/migrations/` SQL migration only covers the original 6 tables; the live database has ~15 additional tables (sessions, seasons, sponsors, appeals, deck identifiers, etc.) not represented in the repo. Don’t treat the migration as the source of truth for the schema.
- `.env` is gitignored and untracked, but the credentials it holds were previously committed to git history — rotate the service role key / JWTs in the Supabase dashboard before making this repo’s history public.
- `/setup` seeds test accounts; confirm it’s not reachable without auth before relying on it in a shared environment.

## Routes overview

- `/` — public leaderboard
- `/login`, `/signup`, `/check-inbox`, `/reset-password` — auth flows
- `/dashboard` — signed-in player dashboard
- `/players/$playerTag` — public player profile
- `/stores`, `/stores/$slug` — store directory and detail
- `/my-stats`, `/settings` — player stats and account settings
- `/sessions`, `/sessions/$sessionId` — standalone session/round tracker
- `/organizer/*` — store organizer panel (store, tournaments, calendar, appeals)
- `/tcg-manager/*` — per-game tournament moderation panel
- `/admin/*` — full admin panel (tournaments, seasons, stores, players, ads, activity)
- `/setup` — test account seeder

## Folder structure

```text
src/
├── components/
│   ├── layout/               # AppHeader, PanelSidebar
│   ├── admin/ ads/ stores/   # feature-specific components
│   ├── tournament-tracker/   # session/round UI
│   ├── upload/               # tournament result upload form
│   └── ui/                   # shadcn Radix UI primitives
├── context/
│   └── nexus-auth.context.tsx  # app-wide auth/role provider
├── hooks/                    # custom hooks
├── integrations/
│   └── nexus/            # the only Supabase client
├── lib/                      # one *.functions.ts per domain, query-cache.ts, error handling
├── routes/                   # public + /organizer + /tcg-manager + /admin + /sessions routes
├── router.tsx                # router setup
├── server.ts                 # Cloudflare Worker entry
├── start.ts                  # TanStack Start setup
└── styles.css                # global styles
```

## Installation

### Clone the repository

```bash
git clone https://github.com/<your-org>/remix-of-geek-tag-circuit-supabase.git
cd remix-of-geek-tag-circuit-supabase
```

### Prerequisites

- Node.js 18+ or Bun
- `bun`, `npm`, or `pnpm`

### Install dependencies

```bash
bun install
# or
npm install
# or
pnpm install
```

## Development

```bash
bun run dev
# or
npm run dev
```

Then visit the Vite dev server URL displayed in the terminal.

## Build

```bash
bun run build
# or
npm run build
```

Preview locally:

```bash
bun run preview
# or
npm run preview
```

## Deployment

Deploy to Cloudflare Workers:

```bash
bun run build
wrangler deploy
```

## Available scripts

- `bun run dev` — start development server
- `bun run build` — production build
- `bun run build:dev` — build in development mode
- `bun run preview` — preview production build
- `bun run lint` — run ESLint
- `bun run format` — format with Prettier

## Dependencies

Key runtime dependencies include:

- `react`, `react-dom`
- `@tanstack/react-router`, `@tanstack/react-query`, `@tanstack/react-start`, `@tanstack/react-virtual`
- `@supabase/supabase-js`
- `@cloudflare/vite-plugin`
- `@tailwindcss/vite`, `tailwindcss`
- `lucide-react`
- `react-hook-form`, `@hookform/resolvers`, `zod`
- `framer-motion`, `recharts`, `embla-carousel-react`
- `read-excel-file`, `xlsx` (tournament result upload parsing)
- `date-fns`, `sonner`

## Configuration files

- `vite.config.ts` — Vite config
- `tsconfig.json` — TS config
- `eslint.config.js` — ESLint config
- `wrangler.jsonc` — Cloudflare Workers config
- `components.json` — shadcn component config
- `supabase/config.toml` — Lovable Cloud project config

## Contributing

1. Create a feature branch.
2. Make your changes.
3. Run:

```bash
bun run lint
bun run format
```

4. Open a pull request.

## License

Add license information here.

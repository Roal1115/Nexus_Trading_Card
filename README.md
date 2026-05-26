# Geek Arena

A Cloudflare Worker–hosted React application for managing a Mexican national TCG circuit. The app supports players, organizers, and admins for One Piece, Magic: The Gathering, and Pokémon TCG rankings and tournament workflows.

## Project summary

This repository contains a full-stack app built with TanStack Start and deployed to Cloudflare Workers. It combines a Supabase-backed auth/data integration with a large set of shadcn/Radix UI components and an in-memory mock data store for demo content.

## What’s included

- `src/` — application source code
- `src/routes/` — TanStack Router pages and panel layouts
- `src/components/` — reusable UI and layout components
- `src/lib/` — helpers, server functions, mock store, and error handling
- `src/integrations/` — Supabase / GeekArena integration clients
- `supabase/` — Lovable Cloud project config and initial migration
- `wrangler.jsonc` — Cloudflare Workers deployment config
- `vite.config.ts` — Vite + TanStack + Tailwind + Cloudflare plugin config

## Tech stack

- React 19
- TypeScript 5.8
- Vite 7
- TanStack Start 1.167 + TanStack Router 1.168
- TanStack React Query 5.83
- Tailwind CSS 4
- Radix UI primitives via shadcn-style components
- Cloudflare Workers deployment via `@cloudflare/vite-plugin`
- Supabase Auth + database

## Key features

- National leaderboard with monthly and semestral views
- Player dashboard and profile information
- Organizer flows for drafting tournaments
- Admin moderation and publish workflows
- Role-aware navigation for players, organizers, and admins
- Responsive, Tailwind-based UI

## Important notes

- The app uses both real Supabase integration and mock in-memory state from `src/lib/mock-store.tsx`.
- Several data flows are currently mock-driven, especially leaderboard and dashboard content.
- There is a branding mismatch in the codebase: the app title appears as `Geek Arena`, `GeekCollector`, and `National Geek` in different places.
- The `supabase/migrations/` SQL migration is incomplete relative to the live app logic; some schema changes referenced in code are not present in the repo.
- Route guards for `/admin/*` and `/organizer/*` are enforced client-side; server functions perform separate role checks but may still accept email from the request body rather than deriving it from a verified session.
- `/setup` is a public route that seeds test accounts; it does not require authentication.

## Routes overview

- `/` — public leaderboard
- `/login` — sign-in page
- `/signup` — registration wizard
- `/check-inbox` — email confirmation instructions
- `/dashboard` — signed-in player dashboard
- `/organizer` — organizer panel shell
- `/organizer/tournaments` — organizer tournament list
- `/organizer/new` — draft tournament creation
- `/admin` — admin review queue
- `/admin/approved` — publish approved tournaments
- `/admin/stores` — store and organizer management
- `/admin/players` — player/role management
- `/setup` — test account seeder

## Folder structure

```text
src/
├── components/
│   ├── layout/
│   │   ├── AppHeader.tsx
│   │   └── PanelSidebar.tsx
│   └── ui/                 # shadcn Radix UI primitives
├── hooks/                  # custom hooks
├── integrations/           # Supabase and GeekArena client code
│   ├── geekarena/
│   └── supabase/
├── lib/                    # helpers, mock store, server functions
├── routes/                 # page routes and panel routes
├── router.tsx              # router setup
├── server.ts               # Cloudflare Worker entry
├── start.ts                # TanStack Start setup
└── styles.css              # global styles
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
- `@tanstack/react-router`
- `@tanstack/react-query`
- `@tanstack/react-start`
- `@supabase/supabase-js`
- `@cloudflare/vite-plugin`
- `@tailwindcss/vite`
- `tailwindcss`
- `lucide-react`
- `react-hook-form`
- `sonner`
- `zod`

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

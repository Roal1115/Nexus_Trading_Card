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

## Correr el proyecto en local

Guía para dejar el proyecto funcionando en una laptop nueva (o en la de siempre) desde cero.

### 1. Requisitos

- **Git** y acceso al repositorio en GitHub.
- **Node.js 22** (probado con 22.14.0; Vite 7 pide 20.19+ o 22.12+) y **npm** (probado con 10.9). Bun es opcional: el repo trae `bun.lock` y `bunfig.toml`, pero el flujo documentado aquí usa npm.
- **Windows:** instala [Git for Windows](https://gitforwindows.org/) y corre los comandos desde **Git Bash**. `npm run dev:sandbox` ejecuta un script de `bash`.
- Internet en la primera sesión: la herramienta de diseño `impeccable` descarga su binario la primera vez que corre.

### 2. Clonar

El repositorio se movió; el nombre anterior (`remix-of-geek-tag-circuit-supabase`) redirige, pero usa el nuevo:

```bash
git clone https://github.com/Roal1115/Nexus_Trading_Card.git
cd Nexus_Trading_Card
git checkout experiemental
```

`experiemental` (así, con esa errata) es la rama que Lovable sincroniza; es la rama de trabajo.

### 3. Instalar dependencias

```bash
npm install
```

### 4. Variables de entorno

Hay tres archivos. Solo `.env` viene con el clon; **`.env.local` y `.env.test` no están en git** (traen llaves) y hay que llevarlos a mano.

| Archivo | ¿En git? | Para qué sirve | Variables |
| --- | --- | --- | --- |
| `.env` | Sí | Valores heredados del scaffold de Lovable Cloud. Viene con el clon, no hay que tocarlo. | `SUPABASE_*`, `VITE_SUPABASE_*` |
| `.env.local` | No | Proyecto de Supabase que usa la app en desarrollo (hoy, el sandbox). | `NEXUS_URL`, `NEXUS_SERVICE_ROLE_KEY`, `VITE_NEXUS_URL`, `VITE_NEXUS_PUBLISHABLE_KEY`, `VITE_ONE_PIECE_GAME_ID` |
| `.env.test` | No | Sandbox: lo lee `npm run dev:sandbox` y los scripts de prueba. Incluye las cuentas demo. | `NEXUS_URL`, `NEXUS_SERVICE_ROLE_KEY`, `NEXUS_ANON_KEY`, `STORE_INVITE_TOKEN_KEY`, `SANDBOX_ADMIN_EMAIL`, `SANDBOX_ADMIN_PASSWORD`, `SANDBOX_DEMO_PLAYER_HISTORY`, `SANDBOX_DEMO_ORGANIZER`, `SANDBOX_DEMO_MANAGER`, `SANDBOX_DEMO_NEW_PLAYER`, `SANDBOX_DEMO_PASSWORD` |

Cómo conseguirlos en la laptop nueva:

- **Copiarlos desde la laptop anterior** (USB cifrado, gestor de contraseñas o transferencia directa). **Nunca por git, correo o chat**: `NEXUS_SERVICE_ROLE_KEY` salta todas las reglas de seguridad de la base de datos.
- O **regenerar las llaves** en el panel de Supabase del proyecto sandbox (`ssbifqcvuhcfijbdtjjh`): *Project Settings → API* (URL, publishable/anon y service role). Los correos y la contraseña de las cuentas demo se piden a quien administra el sandbox.

### 4.1 Base de datos

La app habla con Supabase (auth + Postgres). El esquema vive en `supabase/migrations/`; cualquier cambio de esquema debe llevar su migración nueva ahí. **El sandbox es un proyecto separado de producción**: en desarrollo y en pruebas se usa siempre el sandbox.

### 5. Levantar el servidor

Opción recomendada, contra el **sandbox** (carga `.env.test` y se niega a arrancar si `NEXUS_URL` no es el sandbox):

```bash
npm run dev:sandbox
```

Abre http://localhost:8081 (puerto fijo; si está ocupado el script falla en vez de cambiar de puerto).

Opción alternativa, con lo que haya en `.env`/`.env.local`:

```bash
npm run dev
```

Abre la URL que imprime Vite (por defecto http://localhost:8080).

### 6. Iniciar sesión con las cuentas demo

Los correos y la contraseña están en `.env.test` (variables `SANDBOX_*`). Hay un administrador, un organizador, un manager y varios jugadores demo, así que puedes probar cada rol desde `/login`.

### 7. Verificar que todo está bien

```bash
npx tsc --noEmit            # tipos (debe salir sin errores)
npm run build               # build de producción
```

Los scripts de `scripts/` se corren con `tsx` (se descarga solo con `npx`):

```bash
npx tsx scripts/round-rules.check.mts    # reglas puras, sin base de datos
npx tsx scripts/lifecycle-test.mts       # ciclo de publicación, contra el sandbox
```

Revisa la cabecera de cada script antes de correrlo: algunos leen `.env.test` y escriben en el sandbox. **Nunca los apuntes a producción.**

> `npm run lint` hoy reporta decenas de miles de problemas, casi todos de formato por los saltos de línea de Windows (`CR`) y por las carpetas de skills; no lo uses como criterio de "todo bien" hasta limpiarlo.

### 8. Problemas comunes

- **`NEXUS_URL en .env.test no es el sandbox. No se inició.`** — el `.env.test` está mal copiado o apunta a otro proyecto. Debe apuntar al sandbox (`ssbifqcvuhcfijbdtjjh`).
- **`bash: command not found` o falla `dev:sandbox` en Windows** — abre una terminal de Git Bash, no CMD ni PowerShell.
- **Puerto 8081 ocupado** — hay otro servidor corriendo; ciérralo. No levantes dos servidores Vite a la vez: comparten `node_modules/.vite/deps` y el segundo borra la caché del primero, lo que provoca errores 404 al cargar módulos (por ejemplo en `/calendar`). Si pasa, reinicia el servidor.
- **Pantalla de login o datos vacíos** — falta `.env.local`, o sus llaves no corresponden al proyecto sandbox.
- **Avisos `LF will be replaced by CRLF`** en Windows — son normales y no afectan.

### 9. Trabajar con git y Lovable

Lovable también hace commits en `experiemental`, así que trae sus cambios antes de subir los tuyos y no fuerces el push:

```bash
git pull origin experiemental
git push origin HEAD:experiemental
```

### 10. Herramientas de diseño y asistentes (ya incluidas en el repo)

- Contexto de producto y diseño: `PRODUCT.md`, `DESIGN.md` y `.impeccable/` (sidecar y snapshots de critique).
- Skill `impeccable` en `.claude/skills/`, `.agents/skills/` y `.github/skills/`, con sus agentes en `.claude/agents/` y `.github/agents/` y los hooks en `.codex/hooks.json` y `.github/hooks/`. Su binario no está en git: se descarga solo la primera vez que corre.

### 11. Build, despliegue y scripts

```bash
npm run build      # build de producción (genera .output/)
npm run preview    # sirve ese build localmente
```

El despliegue lo hace Lovable al sincronizar `experiemental`. También se puede desplegar a Cloudflare Workers con `npx wrangler deploy` después de `npm run build` (configuración en `wrangler.jsonc`).

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (puerto 8080 por defecto). |
| `npm run dev:sandbox` | Servidor contra el sandbox en el puerto 8081 (requiere `.env.test` y Git Bash en Windows). |
| `npm run build` | Build de producción. |
| `npm run build:dev` | Build en modo desarrollo. |
| `npm run preview` | Sirve el build localmente. |
| `npm run lint` | ESLint (ver la nota de la sección 7). |
| `npm run format` | Prettier sobre todo el repo (`--write`): úsalo con cuidado, reescribe muchos archivos. |

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
npm run lint
npm run format
```

4. Open a pull request.

## License

Add license information here.


# Geek Collector — Build Plan

A 5-page SPA proof-of-concept for a premium TCG ranking platform. All data is mocked in-memory via React Context so flows (login, approve tournament) feel real without a backend.

## Design System

Set up tokens in `src/styles.css` (oklch equivalents of the brand colors) so all components use semantic Tailwind classes:

- `--background`: deep black for body
- Custom radial gradient utility (crimson `#5C1010` center → black edges) applied to a root layout wrapper
- `--card`: charcoal `#262626` with `border-white/10`, soft shadow, backdrop-blur for glassmorphism
- `--primary`: vibrant orange `#E86A22` (buttons, focus rings, highlights, "Collector" wordmark)
- `--foreground`: white; `--muted-foreground`: gray-400
- Font stack: Inter / Space Grotesk for UI, JetBrains Mono for numeric stats
- Reusable variants: `GlassCard`, `StatNumber` (mono), `RankBadge` (gold/silver/orange tiers), `PrimaryButton`

## Routing (TanStack Start file routes)

```
src/routes/
  __root.tsx              shared shell: radial gradient bg, header, mock-auth context, <Outlet/>
  index.tsx               → / Leaderboard (public)
  login.tsx               → /login Auth (login + create account tabs)
  dashboard.tsx           → /dashboard Player private view (gated by mock auth)
  upload.tsx              → /upload Organizer submission form (gated: role=organizer)
  admin.tsx               → /admin Moderation queue (gated: role=admin)
```

Header nav adapts to auth state: Guest sees Leaderboard + Login; Player sees Dashboard + Logout; Organizer adds Upload; Admin adds Admin.

## Mock State (React Context in `src/lib/mock-store.tsx`)

Single `AppStoreProvider` mounted in `__root.tsx` exposing:

- `currentUser` ({ geekTag, email, role: 'player'|'organizer'|'admin' }) + `login/logout/signup`
- `players[]` — ~40 realistic geek tags with TCG, city, monthly points, semiannual points, wins, losses, OMW%
- `tournaments[]` — recent events per player (for dashboard history)
- `pendingSubmissions[]` — organizer submissions awaiting admin review
- `approveSubmission(id)` — moves submission into `tournaments` and recalculates player points
- `declineSubmission(id)` — removes from queue
- `submitTournament(payload)` — organizer adds to `pendingSubmissions`

Demo accounts pre-seeded so login is one click: a player, an organizer, and an admin.

## Page Builds

**1. `/login`** — Centered glass card on radial bg. Tabs: Login | Create Account. Inputs styled with orange focus ring. "Continue as Guest" link sets guest state and routes to `/`.

**2. `/` Leaderboard** —
- Hero banner ("National Circuit") with sponsor-style strip
- Sticky glass filter bar: TCG select (One Piece / MTG / Pokémon), City, Month, Search Geek Tag
- Two-column grid on desktop (Monthly + Semiannual), stacked on mobile
- Monthly table: Trophy header, top 2 rows show gold ticket badge
- Semiannual table: Medal header, top 3 rows get orange-tinted bg + orange left border, top 12 get silver ticket
- Mobile: collapse Wins/Losses/OMW% columns; expose via row tap-to-expand

**3. `/dashboard`** — Redirects to `/login` if not authed. Hero: huge Geek Tag + National Rank #. Three stat cards (Total Points, W/L Ratio, Tournaments Won) using mono font. Recent Tournaments list with placement, points delta, date.

**4. `/upload`** — Form: TCG dropdown, City, Store Name, Date picker. Dynamic results table where organizer adds rows (Geek Tag + Points) with add/remove row buttons. Massive orange "Submit for Admin Approval" CTA. On submit, push to `pendingSubmissions` and toast confirmation.

**5. `/admin`** — Grid of pending submission cards: Store, Date, TCG, preview of top players/points. Two CTAs per card: orange "Review & Approve" (calls `approveSubmission`), red outline "Decline" (calls `declineSubmission`). Empty state when queue is clear.

## Component Inventory

- `src/components/layout/AppHeader.tsx` — logo wordmark (Geek **Collector** in orange), nav, auth state
- `src/components/layout/RadialBackground.tsx` — gradient wrapper
- `src/components/ui/GlassCard.tsx`
- `src/components/leaderboard/FilterBar.tsx`
- `src/components/leaderboard/LeaderboardTable.tsx` (variant prop: monthly|semiannual)
- `src/components/leaderboard/RankRow.tsx` (handles ticket/highlight tiers)
- `src/components/dashboard/StatCard.tsx`
- `src/components/upload/ResultsRowEditor.tsx`
- `src/components/admin/SubmissionCard.tsx`

## Technical Notes

- TanStack Router file routes; auth guard via `beforeLoad` reading mock context (stored in localStorage so refresh persists)
- All colors flow through `src/styles.css` tokens — no hardcoded hex in components
- Lucide icons: Trophy, Medal, Ticket, Upload, ShieldCheck, X, Check, Search
- Realistic mock data: 40 players across 3 TCGs, 5 pending submissions, 6-tournament histories

## Out of Scope (POC)

- Real backend / persistence beyond localStorage
- Real auth / email verification
- Payment, sponsor logos beyond text placeholders

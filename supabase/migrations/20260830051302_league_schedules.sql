-- Horarios recurrentes propios de una liga interna. Si shares_national_slot es
-- true, la liga simplemente se "engancha" a un store_schedules existente del
-- circuito nacional (mismo torneo, cuenta para ambos) y no se generan entradas
-- de calendario duplicadas. Si es false, es un slot propio (día/hora distintos
-- o el mismo día/hora pero un torneo distinto al nacional).
create table public.store_league_schedules (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.store_leagues(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  shares_national_slot boolean not null default false,
  national_schedule_id uuid references public.store_schedules(id) on delete set null,
  created_at timestamptz not null default now()
);

create index store_league_schedules_league_idx on public.store_league_schedules(league_id);
create index store_league_schedules_store_idx on public.store_league_schedules(store_id);

alter table public.store_league_schedules enable row level security;

create policy store_league_schedules_public_read on public.store_league_schedules
  for select using (true);

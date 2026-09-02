-- Igual que store_league_schedule_overrides pero para el Circuito Nacional
-- (store_schedules) — la liga "padre". Permite a admin/tcg_manager mover la
-- hora o ponerle nombre especial a UNA sola ocurrencia sin tocar la regla
-- recurrente. Reutiliza el mismo mecanismo que /organizer/calendar ya usa
-- para ligas internas, aplicado ahora al schedule nacional.
create table public.store_schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  national_schedule_id uuid not null references public.store_schedules(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  occurrence_date date not null,
  start_time time,
  label text,
  created_at timestamptz not null default now(),
  unique (national_schedule_id, occurrence_date)
);

create index store_schedule_overrides_schedule_idx
  on public.store_schedule_overrides(national_schedule_id);
create index store_schedule_overrides_store_idx
  on public.store_schedule_overrides(store_id);

alter table public.store_schedule_overrides enable row level security;

create policy store_schedule_overrides_public_read on public.store_schedule_overrides
  for select using (true);

-- Excepción puntual a un horario recurrente de liga interna: permite mover la
-- hora (o ponerle un nombre especial) de UNA sola ocurrencia (ej. el torneo
-- especial de aniversario de un viernes) sin tocar la regla recurrente
-- (store_league_schedules), que sigue aplicando el resto de las semanas.
-- Independiente de la tabla tournaments a propósito: la excepción solo cambia
-- lo que el calendario muestra/espera para ese slot; si ya existe un torneo
-- subido para esa fecha, sus propios campos no se tocan.
create table public.store_league_schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  league_schedule_id uuid not null references public.store_league_schedules(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  occurrence_date date not null,
  start_time time,
  label text,
  created_at timestamptz not null default now(),
  unique (league_schedule_id, occurrence_date)
);

create index store_league_schedule_overrides_schedule_idx
  on public.store_league_schedule_overrides(league_schedule_id);
create index store_league_schedule_overrides_store_idx
  on public.store_league_schedule_overrides(store_id);

alter table public.store_league_schedule_overrides enable row level security;

create policy store_league_schedule_overrides_public_read on public.store_league_schedule_overrides
  for select using (true);

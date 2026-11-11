-- Cancelación de una fecha de los horarios semanales y datos del torneo por temporada.
--
-- Las fechas futuras son proyecciones de store_schedules y store_league_schedules,
-- así que solo se guardan las excepciones. La clave es tienda + juego + liga, como
-- schedule_rsvps: editar un horario puede reemplazar su fila.
create table public.schedule_cancellations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  league_id uuid references public.store_leagues(id) on delete cascade,
  occurrence_date date not null,
  reason text not null check (char_length(reason) between 3 and 200),
  cancelled_by uuid references public.players(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index uq_schedule_cancellation on public.schedule_cancellations
  (store_id, game_id, coalesce(league_id, '00000000-0000-0000-0000-000000000000'), occurrence_date);
create index idx_schedule_cancellations_date on public.schedule_cancellations (occurrence_date);

-- Costo y premios por tienda, juego y temporada. Cada cambio es una fila nueva:
-- los valores vigentes siguen públicos hasta effective_date y queda el historial.
create table public.tournament_fichas (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  entry_fee_mxn integer not null check (entry_fee_mxn between 0 and 100000),
  prizes jsonb not null default '[]'::jsonb check (jsonb_typeof(prizes) = 'array'),
  pool_percent smallint check (pool_percent between 1 and 100),
  format text check (char_length(format) <= 80),
  capacity integer check (capacity between 1 and 1024),
  registration_time time,
  notes text check (char_length(notes) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text check (char_length(rejection_reason) <= 300),
  effective_date date,
  submitted_by uuid references public.players(id) on delete set null,
  reviewed_by uuid references public.players(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'approved') = (effective_date is not null))
);
create unique index uq_tournament_ficha_pending on public.tournament_fichas (store_id, game_id, season_id)
  where status = 'pending';
create index idx_tournament_fichas_lookup on public.tournament_fichas (store_id, game_id, season_id, effective_date);
create index idx_tournament_fichas_pending on public.tournament_fichas (game_id, updated_at)
  where status = 'pending';

-- Solo server functions: RLS activo, sin policies y sin acceso de anon/authenticated.
alter table public.schedule_cancellations enable row level security;
alter table public.tournament_fichas enable row level security;
revoke all on public.schedule_cancellations, public.tournament_fichas from public, anon, authenticated;
grant select, insert, delete on public.schedule_cancellations to service_role;
grant select, insert, update, delete on public.tournament_fichas to service_role;

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'tournament_published', 'round_reported', 'schedule_changed', 'store_changed',
  'tournament_cancelled', 'tournament_restored', 'ficha_review', 'ficha_changed'
));

-- En un trigger para que el aviso quede en la misma transacción que la cancelación.
create or replace function public.notify_schedule_cancellation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.schedule_cancellations;
  v_store_name text;
  v_slug text;
  v_type text;
  v_title text;
  v_body text;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;
  select name, slug into v_store_name, v_slug from public.stores where id = v_row.store_id;
  -- Un borrado en cascada de la tienda o la liga no es deshacer una cancelación.
  if v_slug is null or (v_row.league_id is not null and not exists (
    select 1 from public.store_leagues l where l.id = v_row.league_id
  )) then
    return null;
  end if;

  if tg_op = 'DELETE' then
    v_type := 'tournament_restored';
    v_title := 'Torneo confirmado de nuevo en ' || v_store_name;
    v_body := 'El torneo del ' || to_char(v_row.occurrence_date, 'DD/MM/YYYY') || ' ya no está cancelado.';
  else
    v_type := 'tournament_cancelled';
    v_title := 'Torneo cancelado en ' || v_store_name;
    v_body := 'El torneo del ' || to_char(v_row.occurrence_date, 'DD/MM/YYYY') || ' se canceló: ' || v_row.reason;
  end if;

  insert into public.notifications (player_id, type, title, body, url)
  select p.id, v_type, v_title, v_body, '/stores/' || v_slug || '/tournaments'
  from public.players p
  where p.home_store_id = v_row.store_id
     or exists (
       select 1 from public.player_favorite_stores f
       where f.player_id = p.id and f.store_id = v_row.store_id
     )
     or (v_row.league_id is null and exists (
       select 1 from public.schedule_rsvps r
       where r.player_id = p.id and r.store_id = v_row.store_id
         and r.game_id = v_row.game_id and r.occurrence_date = v_row.occurrence_date
     ));
  return null;
end;
$$;

create trigger trg_notify_schedule_cancellation
after insert or delete on public.schedule_cancellations
for each row execute function public.notify_schedule_cancellation();

revoke execute on function public.notify_schedule_cancellation() from public, anon, authenticated;

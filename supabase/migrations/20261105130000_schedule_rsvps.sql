-- Preferencia de jugadores en horarios semanales.
--
-- No es una inscripción: el registro oficial sigue en la app de Bandai. El staff ve
-- la lista por orden de llegada; created_at es el lugar del jugador, y cancelar
-- borra la fila para que volver a pedirla lo mande al final.
--
-- La clave es (tienda, juego, fecha) y no el id del horario: uq_store_schedule ya
-- garantiza un solo horario por tienda, juego y día, y así la lista no depende de
-- que la fila del horario se conserve al editarlo.
create table public.schedule_rsvps (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  occurrence_date date not null,
  player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (store_id, game_id, occurrence_date, player_id)
);

create index idx_schedule_rsvps_player on public.schedule_rsvps (player_id, occurrence_date);
create index idx_schedule_rsvps_game on public.schedule_rsvps (game_id);

-- Solo server functions: RLS activo, sin policies y sin acceso de anon/authenticated.
alter table public.schedule_rsvps enable row level security;
revoke all on public.schedule_rsvps from public, anon, authenticated;
grant select, insert, delete on public.schedule_rsvps to service_role;

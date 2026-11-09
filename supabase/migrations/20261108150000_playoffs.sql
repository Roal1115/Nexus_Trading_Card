-- Playoffs: un evento por nivel y región, con sus 16 jugadores congelados y sus partidas.
-- Solo se accede desde el servidor (service_role), igual que zones y subzones.

create table public.playoff_events (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete restrict,
  game_id uuid not null references public.games(id) on delete restrict,
  level smallint not null check (level between 1 and 3),
  region text not null check (length(trim(region)) between 2 and 120),
  created_by uuid references public.players(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (season_id, game_id, level, region)
);

create table public.playoff_entries (
  event_id uuid not null references public.playoff_events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  seed smallint not null check (seed between 1 and 16),
  group_index smallint check (group_index between 0 and 3),
  points numeric not null default 0,
  primary key (event_id, player_id),
  unique (event_id, seed)
);

create table public.playoff_matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.playoff_events(id) on delete cascade,
  phase text not null check (phase in ('group', 'bracket')),
  round smallint not null,
  slot smallint not null,
  player_a uuid not null references public.players(id) on delete restrict,
  player_b uuid not null references public.players(id) on delete restrict,
  winner_id uuid references public.players(id) on delete restrict,
  loser_wins smallint check (loser_wins between 0 and 1),
  forfeit boolean not null default false,
  updated_by uuid references public.players(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (event_id, phase, round, slot),
  check (player_a <> player_b),
  check (winner_id is null or winner_id in (player_a, player_b))
);

create index playoff_entries_player_idx on public.playoff_entries(player_id);
create index playoff_matches_player_a_idx on public.playoff_matches(player_a);
create index playoff_matches_player_b_idx on public.playoff_matches(player_b);
create index playoff_matches_winner_idx on public.playoff_matches(winner_id);

alter table public.playoff_events enable row level security;
alter table public.playoff_entries enable row level security;
alter table public.playoff_matches enable row level security;
revoke all on public.playoff_events from public, anon, authenticated;
revoke all on public.playoff_entries from public, anon, authenticated;
revoke all on public.playoff_matches from public, anon, authenticated;

-- Todo o nada: un grupo nunca queda congelado sin sus jugadores o sus partidas.
create function public.freeze_playoff_level_one(
  p_season_id uuid,
  p_game_id uuid,
  p_region text,
  p_actor_id uuid,
  p_entries jsonb,
  p_matches jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $fn$
declare
  v_event_id uuid;
begin
  insert into public.playoff_events (season_id, game_id, level, region, created_by)
  values (p_season_id, p_game_id, 1, p_region, p_actor_id)
  returning id into v_event_id;

  insert into public.playoff_entries (event_id, player_id, seed, group_index, points)
  select v_event_id, e.player_id, e.seed, e.group_index, e.points
  from jsonb_to_recordset(p_entries)
    as e(player_id uuid, seed smallint, group_index smallint, points numeric);

  insert into public.playoff_matches (event_id, phase, round, slot, player_a, player_b)
  select v_event_id, 'group', m.round, m.slot, m.player_a, m.player_b
  from jsonb_to_recordset(p_matches)
    as m(round smallint, slot smallint, player_a uuid, player_b uuid);

  return v_event_id;
end;
$fn$;

-- Niveles 2 y 3: los 16 jugadores y la primera ronda, todo o nada.
create function public.create_playoff_bracket(
  p_season_id uuid,
  p_game_id uuid,
  p_level smallint,
  p_region text,
  p_actor_id uuid,
  p_entries jsonb,
  p_matches jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $fn$
declare
  v_event_id uuid;
begin
  insert into public.playoff_events (season_id, game_id, level, region, created_by)
  values (p_season_id, p_game_id, p_level, p_region, p_actor_id)
  returning id into v_event_id;

  insert into public.playoff_entries (event_id, player_id, seed, points)
  select v_event_id, e.player_id, e.seed, e.points
  from jsonb_to_recordset(p_entries) as e(player_id uuid, seed smallint, points numeric);

  insert into public.playoff_matches (event_id, phase, round, slot, player_a, player_b)
  select v_event_id, 'bracket', m.round, m.slot, m.player_a, m.player_b
  from jsonb_to_recordset(p_matches)
    as m(round smallint, slot smallint, player_a uuid, player_b uuid);

  return v_event_id;
end;
$fn$;

revoke all on function public.create_playoff_bracket(uuid, uuid, smallint, text, uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_playoff_bracket(uuid, uuid, smallint, text, uuid, jsonb, jsonb)
  to service_role;

revoke all on function public.freeze_playoff_level_one(uuid, uuid, text, uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.freeze_playoff_level_one(uuid, uuid, text, uuid, jsonb, jsonb)
  to service_role;

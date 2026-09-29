-- El Bandai/TCG ID es la identidad canónica: un (game_id, ID normalizado) = un jugador.
--
-- 1. merge_placeholder_player: el cuerpo de claim_tcg_placeholders v2, extraído para
--    poder fusionar un placeholder concreto (mismo comportamiento que antes).
-- 2. claim_tcg_placeholders: igual que v2, ahora delega en merge_placeholder_player.
-- 3. assign_tcg_id: única vía para dar de alta / cambiar un ID. Si el ID lo tiene un
--    placeholder, lo fusiona en el jugador y luego guarda el ID, todo en una
--    transacción. Si lo tiene una cuenta real, falla con TCG_ID_TAKEN.
-- 4. UNIQUE (game_id, tcg_user_id_normalized). Si ya hubiera duplicados, el CREATE
--    UNIQUE INDEX falla, la migración entera se revierte y nada cambia.

create or replace function public.merge_placeholder_player(p_from uuid, p_to uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_from = p_to then return; end if;
  if not exists (select 1 from players where id = p_from and auth_user_id is null) then
    raise exception 'merge_placeholder_player: % no es un placeholder', p_from;
  end if;

  -- Mismo torneo en ambos: gana la fila de la cuenta real.
  delete from tournament_results f using tournament_results t
    where f.player_id = p_from and t.player_id = p_to and t.tournament_id = f.tournament_id;
  delete from tournament_rsvps f using tournament_rsvps t
    where f.player_id = p_from and t.player_id = p_to and t.tournament_id = f.tournament_id;
  delete from tournament_round_results f using tournament_round_results t
    where f.player_id = p_from and t.player_id = p_to
      and t.tournament_id = f.tournament_id and t.round_number = f.round_number;
  delete from standalone_round_results f using standalone_round_results t
    where f.player_id = p_from and t.player_id = p_to
      and t.session_id = f.session_id and t.round_number = f.round_number;

  -- Mismo slice de leaderboard: sumar al snapshot de la cuenta real.
  update leaderboard_snapshots t set
    total_points = coalesce(t.total_points, 0) + coalesce(f.total_points, 0),
    tournaments_played = coalesce(t.tournaments_played, 0) + coalesce(f.tournaments_played, 0),
    tournaments_won = coalesce(t.tournaments_won, 0) + coalesce(f.tournaments_won, 0),
    last_updated_at = now()
  from leaderboard_snapshots f
  where f.player_id = p_from and t.player_id = p_to
    and t.game_id = f.game_id and t.store_id is not distinct from f.store_id
    and t.timeframe_type = f.timeframe_type and t.timeframe_value = f.timeframe_value;
  delete from leaderboard_snapshots f using leaderboard_snapshots t
    where f.player_id = p_from and t.player_id = p_to
      and t.game_id = f.game_id and t.store_id is not distinct from f.store_id
      and t.timeframe_type = f.timeframe_type and t.timeframe_value = f.timeframe_value;

  update tournament_results set player_id = p_to where player_id = p_from;
  update leaderboard_snapshots set player_id = p_to where player_id = p_from;
  update tournament_rsvps set player_id = p_to where player_id = p_from;
  update tournament_round_results set player_id = p_to where player_id = p_from;
  update tournament_round_results set opponent_player_id = p_to where opponent_player_id = p_from;
  update tournament_round_results set reporter_player_id = p_to where reporter_player_id = p_from;
  update standalone_round_results set player_id = p_to where player_id = p_from;
  update standalone_round_results set opponent_player_id = p_to where opponent_player_id = p_from;
  update standalone_round_results set reporter_player_id = p_to where reporter_player_id = p_from;
  delete from players where id = p_from; -- cascada: player_tcg_ids, achievements, etc.

  -- Re-rankear los slices donde está la cuenta real (mismo orden que recomputeSnapshot).
  update leaderboard_snapshots s set rank_position = r.rn
  from (
    select x.id, row_number() over (
      partition by x.game_id, x.store_id, x.timeframe_type, x.timeframe_value
      order by x.total_points desc nulls last, x.omw_percentage desc nulls last
    ) as rn
    from leaderboard_snapshots x
    where exists (
      select 1 from leaderboard_snapshots me
      where me.player_id = p_to and me.game_id = x.game_id
        and me.store_id is not distinct from x.store_id
        and me.timeframe_type = x.timeframe_type and me.timeframe_value = x.timeframe_value
    )
  ) r
  where s.id = r.id;

  perform recompute_player_achievements(p_to);
end;
$$;

create or replace function public.claim_tcg_placeholders(p_player_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from uuid;
  v_count int := 0;
begin
  for v_from in
    select distinct other.player_id
    from player_tcg_ids mine
    join player_tcg_ids other
      on other.game_id = mine.game_id
     and other.tcg_user_id_normalized = mine.tcg_user_id_normalized
     and other.player_id <> mine.player_id
    join players p on p.id = other.player_id and p.auth_user_id is null
    where mine.player_id = p_player_id
  loop
    perform merge_placeholder_player(v_from, p_player_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.assign_tcg_id(p_player_id uuid, p_game_id uuid, p_tcg_user_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := btrim(p_tcg_user_id);
  v_norm text := coalesce(nullif(ltrim(btrim(p_tcg_user_id), '0'), ''), '0'); -- = normalize_tcg_id
  v_holder uuid;
  v_holder_is_placeholder boolean;
  v_merged int := 0;
begin
  if v_id = '' then
    raise exception 'assign_tcg_id: ID vacío';
  end if;

  select t.player_id, p.auth_user_id is null
    into v_holder, v_holder_is_placeholder
  from player_tcg_ids t
  join players p on p.id = t.player_id
  where t.game_id = p_game_id and t.tcg_user_id_normalized = v_norm
  for update of t;

  if v_holder is not null and v_holder <> p_player_id then
    if not v_holder_is_placeholder then
      raise exception 'TCG_ID_TAKEN' using detail = v_id;
    end if;
    perform merge_placeholder_player(v_holder, p_player_id);
    v_merged := 1;
  end if;

  insert into player_tcg_ids (player_id, game_id, tcg_user_id)
  values (p_player_id, p_game_id, v_id)
  on conflict (player_id, game_id) do update set tcg_user_id = excluded.tcg_user_id;

  return v_merged;
end;
$$;

revoke all on function public.merge_placeholder_player(uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_tcg_placeholders(uuid) from public, anon, authenticated;
revoke all on function public.assign_tcg_id(uuid, uuid, text) from public, anon, authenticated;

create unique index uq_player_tcg_ids_game_normalized
  on public.player_tcg_ids using btree (game_id, tcg_user_id_normalized);

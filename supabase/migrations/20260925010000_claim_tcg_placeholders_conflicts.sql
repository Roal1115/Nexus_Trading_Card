-- claim_tcg_placeholders v2: ya no aborta cuando el placeholder y la cuenta real
-- chocan en un UNIQUE (mismo torneo / mismo slice de leaderboard). La fila de la
-- cuenta real gana; en snapshots se suman los puntos del placeholder y se re-rankea.
--
-- ponytail: la suma de snapshots ignora el tope "top 2 por semana" si ambos
-- jugaron la misma semana, y conserva el OMW% de la cuenta real. Si importa,
-- recalcular el slice con recompute-snapshots.
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
    -- Mismo torneo en ambos: gana la fila de la cuenta real.
    delete from tournament_results f using tournament_results t
      where f.player_id = v_from and t.player_id = p_player_id and t.tournament_id = f.tournament_id;
    delete from tournament_rsvps f using tournament_rsvps t
      where f.player_id = v_from and t.player_id = p_player_id and t.tournament_id = f.tournament_id;
    delete from tournament_round_results f using tournament_round_results t
      where f.player_id = v_from and t.player_id = p_player_id
        and t.tournament_id = f.tournament_id and t.round_number = f.round_number;
    delete from standalone_round_results f using standalone_round_results t
      where f.player_id = v_from and t.player_id = p_player_id
        and t.session_id = f.session_id and t.round_number = f.round_number;

    -- Mismo slice de leaderboard: sumar al snapshot de la cuenta real.
    update leaderboard_snapshots t set
      total_points = coalesce(t.total_points, 0) + coalesce(f.total_points, 0),
      tournaments_played = coalesce(t.tournaments_played, 0) + coalesce(f.tournaments_played, 0),
      tournaments_won = coalesce(t.tournaments_won, 0) + coalesce(f.tournaments_won, 0),
      last_updated_at = now()
    from leaderboard_snapshots f
    where f.player_id = v_from and t.player_id = p_player_id
      and t.game_id = f.game_id and t.store_id is not distinct from f.store_id
      and t.timeframe_type = f.timeframe_type and t.timeframe_value = f.timeframe_value;
    delete from leaderboard_snapshots f using leaderboard_snapshots t
      where f.player_id = v_from and t.player_id = p_player_id
        and t.game_id = f.game_id and t.store_id is not distinct from f.store_id
        and t.timeframe_type = f.timeframe_type and t.timeframe_value = f.timeframe_value;

    update tournament_results set player_id = p_player_id where player_id = v_from;
    update leaderboard_snapshots set player_id = p_player_id where player_id = v_from;
    update tournament_rsvps set player_id = p_player_id where player_id = v_from;
    update tournament_round_results set player_id = p_player_id where player_id = v_from;
    update tournament_round_results set opponent_player_id = p_player_id where opponent_player_id = v_from;
    update tournament_round_results set reporter_player_id = p_player_id where reporter_player_id = v_from;
    update standalone_round_results set player_id = p_player_id where player_id = v_from;
    update standalone_round_results set opponent_player_id = p_player_id where opponent_player_id = v_from;
    update standalone_round_results set reporter_player_id = p_player_id where reporter_player_id = v_from;
    delete from players where id = v_from; -- cascada: player_tcg_ids, achievements, etc.
    v_count := v_count + 1;
  end loop;

  if v_count > 0 then
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
        where me.player_id = p_player_id and me.game_id = x.game_id
          and me.store_id is not distinct from x.store_id
          and me.timeframe_type = x.timeframe_type and me.timeframe_value = x.timeframe_value
      )
    ) r
    where s.id = r.id;

    perform recompute_player_achievements(p_player_id);
  end if;
  return v_count;
end;
$$;

revoke all on function public.claim_tcg_placeholders(uuid) from public, anon, authenticated;

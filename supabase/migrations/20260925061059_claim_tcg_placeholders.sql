-- Cuando un torneo se sube antes de que el jugador tenga cuenta, resolvePlayer
-- crea un jugador "placeholder" (sin auth_user_id) con el nombre del CSV
-- (ej. "FonderKROS | Mandarina") y su Bandai ID. Si después el jugador se
-- registra con otro geek_tag, el signup no lo enlazaba y quedaban dos jugadores
-- con el mismo ID. Esta función fusiona esos placeholders en la cuenta real.
--
-- ponytail: si ambos jugadores ya tienen snapshot en el mismo slice (o estuvieron
-- en el mismo torneo) el UNIQUE aborta y no se fusiona nada; en ese caso hay que
-- fusionar a mano y recalcular snapshots.
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
    perform recompute_player_achievements(p_player_id);
  end if;
  return v_count;
end;
$$;

revoke all on function public.claim_tcg_placeholders(uuid) from public, anon, authenticated;

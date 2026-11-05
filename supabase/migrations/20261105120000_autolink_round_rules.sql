-- Auto-enlace de sesiones: mismas reglas que el vínculo manual.
--
-- 1. Una sesión con más victorias de las que permiten sus match points ya no se
--    enlaza sola: queda pendiente con evento 'conflict' y el jugador ve el motivo
--    al vincular a mano.
-- 2. Se saltan las rondas que ya existan, incluidas las reportadas por el oponente.
--    Antes solo se saltaban las propias, y chocar con el índice único de
--    (torneo, jugador, ronda) abortaba la publicación del torneo completo.
create or replace function public.link_standalone_sessions(p_tournament_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_t              tournaments%rowtype;
  v_session        record;
  v_candidate_count int;
  v_wins           int;
  v_max_wins       int;
  v_linked         int := 0;
begin
  select * into v_t from tournaments where id = p_tournament_id and status = 'PUBLISHED';
  if not found then
    return 0;
  end if;

  for v_session in
    select ss.*
    from standalone_sessions ss
    where ss.session_type = 'competitive'
      and ss.status = 'unlinked'
      and ss.game_id = v_t.game_id
      and ss.store_id = v_t.store_id
      and ss.session_date = v_t.tournament_date
      and case
        when v_t.tournament_time is not null then
          abs(extract(epoch from (ss.session_time - v_t.tournament_time)) / 3600) <= 3
        when exists (
          select 1 from store_schedules sc
          where sc.store_id = v_t.store_id and sc.game_id = v_t.game_id
            and sc.day_of_week = extract(dow from v_t.tournament_date)
        ) then exists (
          select 1 from store_schedules sc
          where sc.store_id = v_t.store_id and sc.game_id = v_t.game_id
            and sc.day_of_week = extract(dow from v_t.tournament_date)
            and abs(extract(epoch from (ss.session_time - sc.start_time)) / 3600) <= 3
        )
        else true
      end
      and exists (
        select 1 from tournament_results tr
        where tr.tournament_id = v_t.id
          and tr.player_id = ss.player_id
      )
  loop
    select count(*) into v_candidate_count
    from tournaments t
    where t.status = 'PUBLISHED'
      and t.game_id = v_session.game_id
      and t.store_id = v_session.store_id
      and t.tournament_date = v_session.session_date
      and exists (
        select 1 from tournament_results tr2
        where tr2.tournament_id = t.id
          and tr2.player_id = v_session.player_id
      );

    -- Victorias que tendría al enlazar: las ya registradas más las rondas nuevas.
    select
      (select count(*) from tournament_round_results trr
       where trr.tournament_id = v_t.id and trr.player_id = v_session.player_id
         and trr.won_match is true)
      + (select count(*) from standalone_round_results srr
         where srr.session_id = v_session.id and srr.won_match is true
           and not exists (
             select 1 from tournament_round_results trr2
             where trr2.tournament_id = v_t.id and trr2.player_id = srr.player_id
               and trr2.round_number = srr.round_number
           ))
    into v_wins;

    select coalesce(tr.match_points, 0) / 3 into v_max_wins
    from tournament_results tr
    where tr.tournament_id = v_t.id and tr.player_id = v_session.player_id;

    if v_candidate_count = 1 and v_wins <= v_max_wins then
      insert into tournament_round_results (
        tournament_id, player_id, opponent_player_id, round_number, is_bye,
        player_leader_id, opponent_leader_id, won_die_roll, turn_order, won_match,
        notes, is_auto_populated, status, reporter_player_id, source_session_id,
        created_at, updated_at
      )
      select
        v_t.id, srr.player_id, srr.opponent_player_id, srr.round_number, srr.is_bye,
        srr.player_leader_id, srr.opponent_leader_id, srr.won_die_roll, srr.turn_order,
        srr.won_match, srr.notes, false, 'confirmed', srr.reporter_player_id,
        v_session.id, now(), now()
      from standalone_round_results srr
      where srr.session_id = v_session.id
        and not exists (
          select 1 from tournament_round_results trr_check
          where trr_check.tournament_id = v_t.id
            and trr_check.player_id = srr.player_id
            and trr_check.round_number = srr.round_number
        );

      update standalone_sessions
      set status = 'matched', tournament_id = v_t.id, updated_at = now()
      where id = v_session.id;

      insert into session_link_events (
        session_id, event_type, tournament_id, actor_player_id, created_at
      ) values (
        v_session.id, 'linked', v_t.id, v_session.player_id, now()
      );
      v_linked := v_linked + 1;
    else
      insert into session_link_events (
        session_id, event_type, tournament_id, actor_player_id, created_at
      ) values (
        v_session.id, 'conflict', v_t.id, v_session.player_id, now()
      );
    end if;
  end loop;

  return v_linked;
end;
$$;

revoke all on function public.link_standalone_sessions(uuid) from public, anon, authenticated;

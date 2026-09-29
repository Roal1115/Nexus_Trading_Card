-- Casos de identidad que necesitan una cuenta real (auth.users). SOLO nexus-admin-test.
-- Todo corre en un bloque que termina en RAISE: nada queda escrito. El resultado
-- viene en el mensaje de error "IDENTITY_CHECK {...}"; cada clave debe ser true.
do $$
declare
  g uuid;
  s uuid;
  t1 uuid;
  au uuid := gen_random_uuid();
  au2 uuid := gen_random_uuid();
  ph uuid; rp uuid; rp2 uuid;
  v_err text;
  res jsonb := '{}';
begin
  insert into games(slug, name) values ('identity-sql-check', 'Identity SQL check') returning id into g;
  insert into stores(slug, name, city) values ('identity-sql-check', 'Identity SQL check', 'X') returning id into s;
  insert into tournaments(store_id, game_id, tournament_date, qualifying_year, qualifying_month, qualifying_semester, status)
    values (s, g, '2026-09-01', 2026, 9, 2, 'PUBLISHED') returning id into t1;

  -- Placeholder de un torneo histórico: JugadorA / 123 con resultado.
  insert into players(geek_tag, role, is_active) values ('IDTSQL JugadorA', 'player', true) returning id into ph;
  insert into player_tcg_ids(player_id, game_id, tcg_user_id) values (ph, g, '123');
  insert into tournament_results(tournament_id, player_id, rank, points_earned) values (t1, ph, 1, 10);

  -- Cuenta real "Jugador AB" se registra con 00123 (signup → assign_tcg_id).
  insert into auth.users(id, email) values (au, 'identity-check-1@example.test');
  insert into players(geek_tag, role, is_active, auth_user_id) values ('IDTSQL Jugador AB', 'player', false, au) returning id into rp;
  res := res || jsonb_build_object('F_claim_merged_1', assign_tcg_id(rp, g, '00123') = 1);
  res := res || jsonb_build_object(
    'F_one_holder', (select count(*) = 1 from player_tcg_ids where game_id = g and tcg_user_id_normalized = '123'),
    'F_holder_is_real', (select player_id = rp from player_tcg_ids where game_id = g and tcg_user_id_normalized = '123'),
    'F_placeholder_gone', not exists (select 1 from players where id = ph),
    'F_history_moved', (select player_id = rp from tournament_results where tournament_id = t1));

  -- Otra cuenta real intenta registrar el mismo ID → TCG_ID_TAKEN, nada cambia.
  insert into auth.users(id, email) values (au2, 'identity-check-2@example.test');
  insert into players(geek_tag, role, is_active, auth_user_id) values ('IDTSQL OtroReal', 'player', false, au2) returning id into rp2;
  begin
    perform assign_tcg_id(rp2, g, '123');
    v_err := 'no error';
  exception when others then v_err := sqlerrm;
  end;
  res := res || jsonb_build_object(
    'TAKEN_real_vs_real_rejected', v_err = 'TCG_ID_TAKEN',
    'TAKEN_still_one_holder', (select count(*) = 1 from player_tcg_ids where game_id = g and tcg_user_id_normalized = '123'));

  -- Mismo ID re-asignado a su dueño → no-op.
  res := res || jsonb_build_object('SELF_reassign_noop', assign_tcg_id(rp, g, '123') = 0);

  -- merge_placeholder_player se niega a fusionar una cuenta real.
  begin
    perform merge_placeholder_player(rp2, rp);
    v_err := 'no error';
  exception when others then v_err := sqlerrm;
  end;
  res := res || jsonb_build_object('MERGE_refuses_real_account', v_err like '%no es un placeholder%');

  raise exception 'IDENTITY_CHECK %', res;
end $$;

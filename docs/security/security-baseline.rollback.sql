-- Revierte solo lo nuevo de 20261105040921_security_baseline.sql: permisos de las
-- demás tablas y privilegios por defecto. Conserva cerrados players, player_tcg_ids
-- y recompute_player_achievements. Ejecutar como postgres.
do $rollback$
declare
  r record;
begin
  perform set_config('lock_timeout', '5s', true);

  if current_user <> 'postgres' then
    raise exception 'precondition failed: must run as postgres (current_user=%)', current_user;
  end if;

  revoke update (read_at) on public.notifications from authenticated;
  for r in
    select c.oid::regclass as rel
      from pg_class c
     where c.relnamespace = 'public'::regnamespace
       and c.relkind in ('r', 'p', 'v', 'm')
       and c.oid not in ('public.players'::regclass, 'public.players_public'::regclass,
                         'public.public_players_view'::regclass, 'public.player_tcg_ids'::regclass)
  loop
    execute format('grant all on table %s to anon, authenticated', r.rel);
  end loop;

  alter default privileges for role postgres in schema public grant all on tables to anon, authenticated;
  alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated;
  alter default privileges for role postgres in schema public grant all on functions to anon, authenticated;
  alter default privileges for role postgres grant execute on functions to public;
end
$rollback$;

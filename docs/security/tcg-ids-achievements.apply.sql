-- Cierra la escritura directa de player_tcg_ids y la ejecución pública de
-- recompute_player_achievements. Un solo DO atómico; ejecutar como postgres.
-- De un solo uso: aborta sin cambios si el estado no es el original.
do $apply$
declare
  c_tbl        constant regclass := 'public.player_tcg_ids'::regclass;
  c_fn         constant regprocedure := 'public.recompute_player_achievements(uuid)'::regprocedure;
  -- ACLs ordenados con collate "C": el orden interno cambia tras revoke/grant.
  c_tbl_before constant text[] := array['anon=arwdDxtm/postgres', 'authenticated=arwdDxtm/postgres',
                                        'postgres=arwdDxtm/postgres', 'service_role=arwdDxtm/postgres'];
  c_tbl_after  constant text[] := array['anon=r/postgres', 'authenticated=r/postgres',
                                        'postgres=arwdDxtm/postgres', 'service_role=arwdDxtm/postgres'];
  c_fn_before  constant text[] := array['=X/postgres', 'anon=X/postgres', 'authenticated=X/postgres',
                                        'postgres=X/postgres', 'service_role=X/postgres'];
  c_fn_after   constant text[] := array['postgres=X/postgres', 'service_role=X/postgres'];
  c_own_qual   constant text := E'(EXISTS ( SELECT 1\n   FROM players\n  WHERE ((players.id = player_tcg_ids.player_id) AND (players.auth_user_id = auth.uid()))))';
  v_tbl_acl    text[];
  v_fn_acl     text[];
begin
  perform set_config('lock_timeout', '5s', true);

  if current_user <> 'postgres' then
    raise exception 'precondition failed: must run as postgres (current_user=%)', current_user;
  end if;

  lock table public.player_tcg_ids in share row exclusive mode;

  select array(select a::text from unnest(relacl) a order by a::text collate "C") into v_tbl_acl
    from pg_class where oid = c_tbl;
  select array(select a::text from unnest(proacl) a order by a::text collate "C") into v_fn_acl
    from pg_proc where oid = c_fn;

  if v_tbl_acl is distinct from c_tbl_before then
    raise exception 'precondition failed: table ACL %', v_tbl_acl;
  end if;
  if v_fn_acl is distinct from c_fn_before then
    raise exception 'precondition failed: function ACL %', v_fn_acl;
  end if;
  if exists (select 1 from pg_attribute where attrelid = c_tbl and attnum > 0 and attacl is not null) then
    raise exception 'precondition failed: column-level ACLs present';
  end if;
  if not exists (select 1 from pg_class where oid = c_tbl and relrowsecurity and not relforcerowsecurity) then
    raise exception 'precondition failed: unexpected RLS flags';
  end if;
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'player_tcg_ids'
                    and policyname = 'player_tcg_ids_own_write' and cmd = 'ALL' and roles = '{public}'
                    and replace(qual, 'public.', '') = c_own_qual and with_check is null) then
    raise exception 'precondition failed: player_tcg_ids_own_write differs from the expected one';
  end if;

  drop policy player_tcg_ids_own_write on public.player_tcg_ids;
  revoke all on table public.player_tcg_ids from anon, authenticated;
  grant select on table public.player_tcg_ids to anon, authenticated;
  revoke execute on function public.recompute_player_achievements(uuid) from public, anon, authenticated;

  select array(select a::text from unnest(relacl) a order by a::text collate "C") into v_tbl_acl
    from pg_class where oid = c_tbl;
  select array(select a::text from unnest(proacl) a order by a::text collate "C") into v_fn_acl
    from pg_proc where oid = c_fn;

  if v_tbl_acl is distinct from c_tbl_after then
    raise exception 'postcondition failed: table ACL %', v_tbl_acl;
  end if;
  if v_fn_acl is distinct from c_fn_after then
    raise exception 'postcondition failed: function ACL %', v_fn_acl;
  end if;
  if has_function_privilege('anon', c_fn, 'execute')
     or has_function_privilege('authenticated', c_fn, 'execute')
     or not has_function_privilege('service_role', c_fn, 'execute') then
    raise exception 'postcondition failed: effective EXECUTE on recompute_player_achievements';
  end if;
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'player_tcg_ids'
                and policyname = 'player_tcg_ids_own_write') then
    raise exception 'postcondition failed: player_tcg_ids_own_write still exists';
  end if;
end
$apply$;

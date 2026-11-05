-- Línea base de permisos, idempotente: una base reconstruida desde migraciones ya
-- no reabre lo cerrado a mano (docs/security/). La app usa service_role; el navegador
-- solo lee y escribe directo en notifications (read_at) y push_subscriptions.
-- Una tabla o función nueva nace cerrada: si el navegador la necesita, hay que
-- hacerle grant explícito en su migración.
set local lock_timeout = '5s';

-- Tablas y vistas existentes.
revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant update (read_at) on public.notifications to authenticated;
grant insert, delete on public.push_subscriptions to authenticated;

-- docs/security/tcg-ids-achievements.apply.sql
drop policy if exists player_tcg_ids_own_write on public.player_tcg_ids;
revoke execute on function public.recompute_player_achievements(uuid) from public, anon, authenticated;

-- docs/security/phase0-players-trust-root.apply.sql
create or replace function public.players_guard_privileged_cols()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
begin
  if current_user in ('anon', 'authenticated')
     and (new.id is distinct from old.id
          or new.role is distinct from old.role
          or new.auth_user_id is distinct from old.auth_user_id
          or new.email is distinct from old.email
          or new.home_store_id is distinct from old.home_store_id
          or new.is_active is distinct from old.is_active) then
    raise exception 'players: privileged column update denied' using errcode = '42501';
  end if;
  return new;
end
$fn$;
revoke all on function public.players_guard_privileged_cols() from public, anon, authenticated;
create or replace trigger trg_players_guard before update on public.players
  for each row execute function public.players_guard_privileged_cols();

-- Objetos futuros creados por postgres. service_role conserva sus defaults.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
alter default privileges for role postgres revoke execute on functions from public;

do $check$
declare
  v_bad text;
begin
  select string_agg(format('%s:%s:%s', c.relname, a.grantee::regrole, a.privilege_type), ', ') into v_bad
    from pg_class c
    cross join lateral aclexplode(c.relacl) a
   where c.relnamespace = 'public'::regnamespace
     and c.relkind in ('r', 'p', 'v', 'm')
     and a.grantee in ('anon'::regrole, 'authenticated'::regrole)
     and a.privilege_type <> 'SELECT'
     and not (c.oid = 'public.push_subscriptions'::regclass
              and a.grantee = 'authenticated'::regrole
              and a.privilege_type in ('INSERT', 'DELETE'));
  if v_bad is not null then
    raise exception 'security baseline: unexpected table privileges: %', v_bad;
  end if;

  select string_agg(format('%s.%s', a.attrelid::regclass, a.attname), ', ') into v_bad
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
   where c.relnamespace = 'public'::regnamespace
     and a.attacl is not null
     and not (a.attrelid = 'public.notifications'::regclass and a.attname = 'read_at');
  if v_bad is not null then
    raise exception 'security baseline: unexpected column privileges: %', v_bad;
  end if;

  if has_function_privilege('anon', 'public.recompute_player_achievements(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.recompute_player_achievements(uuid)', 'execute') then
    raise exception 'security baseline: recompute_player_achievements is open';
  end if;

  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.prosecdef
     and (has_function_privilege('anon', p.oid, 'execute')
          or has_function_privilege('authenticated', p.oid, 'execute'));
  if v_bad is not null then
    raise exception 'security baseline: open SECURITY DEFINER functions: %', v_bad;
  end if;

  if exists (select 1
               from pg_default_acl d
               cross join lateral aclexplode(d.defaclacl) a
              where d.defaclrole = 'postgres'::regrole
                and d.defaclnamespace = 'public'::regnamespace
                and a.grantee in ('anon'::regrole, 'authenticated'::regrole)) then
    raise exception 'security baseline: default privileges still open';
  end if;

  -- Sin fila global, las funciones nuevas nacen con EXECUTE para PUBLIC.
  if not exists (select 1
                   from pg_default_acl d
                  where d.defaclrole = 'postgres'::regrole
                    and d.defaclnamespace = 0
                    and d.defaclobjtype = 'f'
                    and not exists (select 1 from aclexplode(d.defaclacl) a where a.grantee = 0)) then
    raise exception 'security baseline: new functions still default to PUBLIC';
  end if;
end
$check$;

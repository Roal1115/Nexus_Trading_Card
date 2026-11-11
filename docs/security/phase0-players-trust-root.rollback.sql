do $rollback$
declare
  c_orig_sig    constant text := '164f7bee8f2fce43caf55fb92878ff03';
  c_after_sig   constant text := '03b052b6f219ac2279d518c9715552b9';
  c_fn_sig      constant text := 'fd9f5c97e8c006d1035d6cecc822b745';
  c_fn_src_md5  constant text := 'e5e27b0a7f42b7ad9b7237aba829b0d7';
  c_pol_sig     constant text := 'edd62bf9b7e2ad2060474742bb572cc2';
  c_rels        constant oid[] := array['public.players'::regclass::oid,
                                        'public.players_public'::regclass::oid,
                                        'public.public_players_view'::regclass::oid];
  c_roles       constant text[] := array['anon', 'authenticated', 'service_role'];
  c_tprivs      constant text[] := array['SELECT', 'INSERT', 'UPDATE', 'DELETE',
                                         'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'];
  c_cprivs      constant text[] := array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'];
  r             record;
  v_fn          oid;
  v_hard        boolean;
  v_label       text;
begin
  perform set_config('lock_timeout', '5s', true);

  if current_user <> 'postgres' then
    raise exception 'Rollback precondition failed: must run as postgres (current_user=%)', current_user;
  end if;

  lock table public.players in share row exclusive mode;

  -- phase 1 = preconditions (Phase 0 state); phase 2 = changes; phase 3 = postconditions (original state)
  for v_phase in 1..3 loop
    if v_phase = 2 then
      -- ===== CHANGES: reached only if every phase-1 check passed =====
      drop trigger trg_players_guard on public.players;
      drop function public.players_guard_privileged_cols();

      revoke all on table public.players, public.players_public, public.public_players_view
        from service_role;
      grant select, insert, update, delete, truncate, references, trigger, maintain
        on table public.players, public.players_public, public.public_players_view
        to anon, authenticated;
      grant select, insert, update, delete, truncate, references, trigger, maintain
        on table public.players, public.players_public, public.public_players_view
        to service_role;
      continue;
    end if;

    v_hard  := (v_phase = 1);
    v_label := case when v_phase = 1 then 'precondition' else 'postcondition' end;

    -- A. explicit ACLs: owner and privilege signature of the three relations
    for r in
      select c.oid::regclass::text as rel,
             pg_get_userbyid(c.relowner)::text as owner_name,
             (select md5(string_agg(a.grantee::regrole::text || ':' || a.privilege_type || ':' ||
                                    a.is_grantable::text || ':' || a.grantor::regrole::text,
                                    '|' order by a.grantee::regrole::text, a.privilege_type))
                from aclexplode(c.relacl) a) as sig
        from pg_class c
       where c.oid = any (c_rels)
    loop
      if r.owner_name <> 'postgres'
         or r.sig is distinct from (case when v_hard then c_after_sig else c_orig_sig end) then
        raise exception 'Rollback % failed: unexpected owner/ACL on % (owner=%, sig=%)',
          v_label, r.rel, r.owner_name, r.sig;
      end if;
    end loop;

    -- B. PUBLIC must hold nothing on the relations
    if exists (select 1 from pg_class c, aclexplode(c.relacl) a
                where c.oid = any (c_rels) and a.grantee = 0) then
      raise exception 'Rollback % failed: PUBLIC holds privileges on the relations', v_label;
    end if;

    -- C. effective table privileges (explicit ACL + PUBLIC + inherited role membership)
    for r in
      select c.relname::text as rel, ro.rn as role_name, pr.p as priv,
             has_table_privilege(ro.rn::name, c.oid, pr.p) as actual
        from pg_class c
       cross join unnest(c_roles) as ro(rn)
       cross join unnest(c_tprivs) as pr(p)
       where c.oid = any (c_rels)
    loop
      if r.actual is distinct from (not v_hard or r.role_name = 'service_role' or r.priv = 'SELECT') then
        raise exception 'Rollback % failed: effective % on % for %: actual=%',
          v_label, r.priv, r.rel, r.role_name, r.actual;
      end if;
    end loop;

    -- D. effective column privileges
    for r in
      select c.relname::text as rel, a.attname::text as col, ro.rn as role_name, pr.p as priv,
             has_column_privilege(ro.rn::name, c.oid, a.attnum, pr.p) as actual
        from pg_class c
        join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
       cross join unnest(c_roles) as ro(rn)
       cross join unnest(c_cprivs) as pr(p)
       where c.oid = any (c_rels)
    loop
      if r.actual is distinct from (not v_hard or r.role_name = 'service_role' or r.priv = 'SELECT') then
        raise exception 'Rollback % failed: effective column % on %.% for %: actual=%',
          v_label, r.priv, r.rel, r.col, r.role_name, r.actual;
      end if;
    end loop;

    -- E. role memberships and attributes of the three roles
    if exists (select 1 from pg_auth_members m join pg_roles u on u.oid = m.member
                where u.rolname::text = any (c_roles)) then
      raise exception 'Rollback % failed: anon/authenticated/service_role hold role memberships', v_label;
    end if;
    if exists (select 1 from pg_roles
                where rolname in ('anon', 'authenticated') and (rolsuper or rolbypassrls)) then
      raise exception 'Rollback % failed: anon/authenticated are superuser or bypass RLS', v_label;
    end if;

    -- F. no column-level ACLs
    if exists (select 1 from pg_attribute
                where attrelid = any (c_rels) and attnum > 0 and not attisdropped and attacl is not null) then
      raise exception 'Rollback % failed: column-level ACLs present', v_label;
    end if;

    -- G. full policy definitions on players (name, permissive, command, roles, qual, with_check)
    if (select md5(string_agg(policyname || '|' || permissive || '|' || cmd || '|' || roles::text || '|' ||
                              coalesce(qual, '<null>') || '|' || coalesce(with_check, '<null>'),
                              E'\n' order by policyname))
          from pg_policies where schemaname = 'public' and tablename = 'players')
       is distinct from c_pol_sig then
      raise exception 'Rollback % failed: policy definitions on players differ from the expected ones', v_label;
    end if;

    -- H. relation kinds and RLS flags
    if (select count(*) from pg_class
         where oid = c_rels[1] and relkind = 'r' and relrowsecurity and not relforcerowsecurity) <> 1
       or (select count(*) from pg_class
            where oid = any (c_rels[2:3]) and relkind = 'v') <> 2 then
      raise exception 'Rollback % failed: unexpected relkind/RLS flags', v_label;
    end if;

    if v_phase = 1 then
      -- I. the objects to be dropped must be exactly the ones created by Phase 0
      select p.oid into v_fn
        from pg_proc p
       where p.pronamespace = 'public'::regnamespace
         and p.proname = 'players_guard_privileged_cols'
         and p.pronargs = 0
         and p.prorettype = 'trigger'::regtype
         and p.prolang = (select oid from pg_language where lanname = 'plpgsql')
         and not p.prosecdef
         and p.proconfig = array['search_path=""']
         and pg_get_userbyid(p.proowner)::text = 'postgres'
         and md5(regexp_replace(p.prosrc, '\s+', ' ', 'g')) = c_fn_src_md5
         and (select md5(string_agg(a.grantee::regrole::text || ':' || a.privilege_type || ':' ||
                                    a.is_grantable::text || ':' || a.grantor::regrole::text,
                                    '|' order by a.grantee::regrole::text, a.privilege_type))
                from aclexplode(p.proacl) a) = c_fn_sig;
      if v_fn is null
         or (select count(*) from pg_proc
              where pronamespace = 'public'::regnamespace and proname = 'players_guard_privileged_cols') <> 1 then
        raise exception 'Rollback precondition failed: guard function is not the one created by Phase 0';
      end if;

      if (select count(*) from pg_trigger where tgrelid = c_rels[1] and not tgisinternal) <> 1
         or not exists (select 1 from pg_trigger
                         where tgrelid = c_rels[1] and tgname = 'trg_players_guard'
                           and not tgisinternal and tgenabled = 'O' and tgtype = 19
                           and tgfoid = v_fn and tgnargs = 0 and tgconstraint = 0
                           and tgqual is null and tgattr::text = '') then
        raise exception 'Rollback precondition failed: guard trigger is not the one created by Phase 0';
      end if;

      if (select count(*) from pg_trigger where tgfoid = v_fn) <> 1 then
        raise exception 'Rollback precondition failed: guard function is used by other triggers';
      end if;
    else
      -- I. the guard objects must be gone
      if exists (select 1 from pg_trigger where tgrelid = c_rels[1] and not tgisinternal)
         or exists (select 1 from pg_proc
                     where pronamespace = 'public'::regnamespace and proname = 'players_guard_privileged_cols') then
        raise exception 'Rollback postcondition failed: guard objects still present';
      end if;
    end if;
  end loop;
end
$rollback$;
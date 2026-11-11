-- B1/B2/B3 en una sola transacción. Requiere M1 (uploaded_by) y M2 (actor_id nullable).
-- Idempotente: una segunda corrida cambia 0 filas. Revisar antes prod-backfill-preview.sql.
-- Si la verificación final falla, todo se revierte.
begin;

-- B1
with src as (
  select t.id, t.approved_at old_value,
    (select max(a.created_at) from admin_audit_log a
      where a.target_id = t.id and a.action = 'TOURNAMENT_APPROVED' and a.created_at <= t.published_at) new_value
  from tournaments t where t.published_at is not null and t.approved_at = t.published_at
), upd as (
  update tournaments t set approved_at = s.new_value from src s
  where t.id = s.id and s.new_value is not null and t.approved_at = t.published_at
  returning t.id, t.game_id, t.store_id, t.tournament_date, s.old_value, s.new_value
)
insert into admin_audit_log (actor_id, actor_role, actor_tag, action, target_type, target_id, target_label, metadata)
select null, 'system', 'Sistema (corrección de datos)', 'DATA_CORRECTED', 'tournament', u.id,
  g.name || ' — ' || st.name || ' — ' || u.tournament_date,
  jsonb_build_object('field', 'approved_at', 'old', u.old_value, 'new', u.new_value, 'source', 'admin_audit_log.TOURNAMENT_APPROVED')
from upd u join games g on g.id = u.game_id join stores st on st.id = u.store_id;

-- B2
with src as (
  select distinct on (t.id) t.id, t.game_id, t.store_id, t.tournament_date, p.id player_id, p.geek_tag, o.name object_name
  from tournaments t
  join storage.objects o on o.bucket_id = 'tournament-files' and o.name like 'tournaments/' || t.id::text || '.%'
  join players p on p.auth_user_id = o.owner
  where t.uploaded_by is null
  order by t.id, o.created_at asc
), upd as (
  update tournaments t set uploaded_by = s.player_id from src s
  where t.id = s.id and t.uploaded_by is null returning s.*
)
insert into admin_audit_log (actor_id, actor_role, actor_tag, action, target_type, target_id, target_label, metadata)
select null, 'system', 'Sistema (corrección de datos)', 'DATA_CORRECTED', 'tournament', u.id,
  g.name || ' — ' || st.name || ' — ' || u.tournament_date,
  jsonb_build_object('field', 'uploaded_by', 'old', null, 'new', u.player_id, 'new_tag', u.geek_tag, 'source', 'storage.objects.owner:' || u.object_name)
from upd u join games g on g.id = u.game_id join stores st on st.id = u.store_id;

-- B3
with bad as (
  select a.id, a.target_id, a.target_label,
    regexp_match(a.target_label, '^([0-9a-f-]{36}) — ([0-9a-f-]{36})(?: — (\d{4}-\d{2}-\d{2}))?$') m
  from admin_audit_log a
  where a.target_type = 'tournament'
    and a.target_label ~ '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
    and not (coalesce(a.metadata, '{}'::jsonb) ? 'original_label')
), resolved as (
  select b.id, b.target_label,
    case when b.m is not null
      then coalesce(g.name, 'TCG desconocido') || ' — ' || coalesce(s.name, 'Tienda eliminada') || coalesce(' — ' || coalesce(b.m[3], t.tournament_date::text), '')
      else coalesce((select g2.name || ' — ' || s2.name || ' — ' || t2.tournament_date
                     from tournaments t2 join games g2 on g2.id = t2.game_id join stores s2 on s2.id = t2.store_id
                     where t2.id = b.target_id), 'Torneo eliminado')
    end new_label
  from bad b
  left join games g on b.m is not null and g.id = b.m[1]::uuid
  left join stores s on b.m is not null and s.id = b.m[2]::uuid
  left join tournaments t on t.id = b.target_id
)
update admin_audit_log a set target_label = r.new_label,
  metadata = coalesce(a.metadata, '{}'::jsonb) || jsonb_build_object('original_label', r.target_label, 'label_backfilled_at', now())
from resolved r where a.id = r.id;

-- Verificación: si algo quedó sin corregir, se revierte todo.
do $$
declare b1 int; b3 int;
begin
  select count(*) into b1 from tournaments where published_at is not null and approved_at = published_at;
  select count(*) into b3 from admin_audit_log where target_type = 'tournament'
    and target_label ~ '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  if b1 > 0 or b3 > 0 then
    raise exception 'Backfill incompleto: B1 pendientes=%, B3 pendientes=% — revertido', b1, b3;
  end if;
end $$;

commit;

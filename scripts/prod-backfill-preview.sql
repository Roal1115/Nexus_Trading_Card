-- B1/B2/B3: vista previa de SOLO LECTURA. Correr DESPUÉS de M1 y M2.
-- Muestra cada fila que prod-backfill-apply.sql cambiaría, con valor viejo y nuevo.

-- B1: approved_at que fue sobrescrito con published_at → última aprobación real del log.
select 'B1' backfill, t.id tournament_id, t.approved_at old_approved_at,
  (select max(a.created_at) from admin_audit_log a
    where a.target_id = t.id and a.action = 'TOURNAMENT_APPROVED' and a.created_at <= t.published_at) new_approved_at
from tournaments t
where t.published_at is not null and t.approved_at = t.published_at;

-- B2: uploaded_by desde el dueño del CSV en storage (primer archivo subido).
select distinct on (t.id) 'B2' backfill, t.id tournament_id, p.id new_uploaded_by, p.geek_tag, p.role, o.name csv_object, o.created_at uploaded_at
from tournaments t
join storage.objects o on o.bucket_id = 'tournament-files' and o.name like 'tournaments/' || t.id::text || '.%'
join players p on p.auth_user_id = o.owner
where t.uploaded_by is null
order by t.id, o.created_at asc;

-- B3: etiquetas de auditoría con UUIDs → "TCG — Tienda — fecha" (el original se guarda en metadata).
with bad as (
  select a.id, a.action, a.created_at, a.target_id, a.target_label,
    regexp_match(a.target_label, '^([0-9a-f-]{36}) — ([0-9a-f-]{36})(?: — (\d{4}-\d{2}-\d{2}))?$') m
  from admin_audit_log a
  where a.target_type = 'tournament'
    and a.target_label ~ '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
    and not (coalesce(a.metadata, '{}'::jsonb) ? 'original_label')
)
select 'B3' backfill, b.id audit_id, b.action, b.created_at, b.target_label old_label,
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
order by b.created_at;

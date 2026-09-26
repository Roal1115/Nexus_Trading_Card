-- El historial de auditoría no se borra al eliminar un jugador: actor_id queda
-- en null y actor_tag/actor_role conservan quién fue. También permite eventos
-- del sistema (publicación programada) sin jugador asociado.
alter table public.admin_audit_log alter column actor_id drop not null;

alter table public.admin_audit_log drop constraint if exists admin_audit_log_actor_id_fkey;
alter table public.admin_audit_log
  add constraint admin_audit_log_actor_id_fkey
  foreign key (actor_id) references public.players(id) on delete set null;

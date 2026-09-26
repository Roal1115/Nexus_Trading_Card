-- Quién subió realmente el torneo (usuario autenticado). Independiente de la
-- tienda/organizador: no reemplaza store_id ni approved_by.
alter table public.tournaments
  add column if not exists uploaded_by uuid references public.players(id) on delete set null;

create index if not exists idx_tournaments_uploaded_by on public.tournaments (uploaded_by);

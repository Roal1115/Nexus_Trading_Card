-- Un torneo declara a qué liga pertenece al momento de subirse: NULL = Liga
-- Semestral / Circuito Nacional (default de siempre), un valor = liga interna
-- específica. Esto desbloquea múltiples torneos del mismo TCG el mismo día
-- en la misma tienda, siempre que sean de ligas distintas.
alter table public.tournaments
  add column league_id uuid references public.store_leagues(id) on delete set null;

-- ponytail: flag temporal, todas las tiendas en true para la demo — se
-- reemplaza cuando exista el sistema de suscripción real para el plugin de
-- ligas internas.
alter table public.stores
  add column internal_leagues_enabled boolean not null default true;

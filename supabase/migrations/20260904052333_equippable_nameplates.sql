-- Nameplates equipables: mismo patrón que Badge (label sale de
-- achievement_definitions.name, gate por reward_type ilike '%nameplate%'),
-- pero a diferencia de Title/Badge el nameplate es una franja decorativa
-- (no un texto suelto), así que el perfil también necesita el tier para
-- pintarla con el color correcto — no hace falta columna nueva, tier ya
-- existe en achievement_definitions.

alter table public.players
  add column equipped_nameplate_key text references public.achievement_definitions(key);

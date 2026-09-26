-- Badges equipables: a diferencia de Title, reward_detail ya es un nombre
-- limpio ("Victory Badge.", "Top 8 Badge.") así que no hace falta una
-- columna de parseo — el gate de elegibilidad es reward_type ilike '%badge%'
-- y el label se toma de achievement_definitions.name en la app.

alter table public.players
  add column equipped_badge_key text references public.achievement_definitions(key);

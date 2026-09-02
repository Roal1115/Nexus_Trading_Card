-- Preferencia de TCG/zona del jugador para pre-llenar filtros en calendario,
-- tiendas, etc. preferences_prompted_at marca que ya se le preguntó (una vez
-- respondida o descartada), para no volver a mostrar el prompt en otro
-- dispositivo — a diferencia del TCG activo actual, que solo vive en
-- localStorage (nexus.activeTcg) y no sigue a la cuenta.
alter table public.players
  add column preferred_game_id uuid references public.games(id) on delete set null,
  add column preferred_zone text,
  add column preferences_prompted_at timestamptz;

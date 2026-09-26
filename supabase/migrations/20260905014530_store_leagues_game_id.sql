-- Ligas internas hoy no declaran para qué TCG son — el organizador podía
-- mezclar torneos de distintos juegos en una misma liga, y /stores/$slug
-- solo mostraba UNA liga activa (sin noción de "una por TCG"). Nullable
-- para no romper ligas ya existentes; el server valida "requerido" para
-- ligas nuevas/editadas desde acá en adelante.
alter table public.store_leagues
  add column game_id uuid references public.games(id);

create index store_leagues_game_id_idx on public.store_leagues(game_id);

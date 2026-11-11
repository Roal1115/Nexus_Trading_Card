-- Cierra dos huecos de RLS detectados por introspección (2026-07-14).
-- Ninguna de estas tablas se lee desde el browser (todo va por server
-- functions con service role), así que revocar el acceso anónimo es seguro.

-- 1. players: la policy publica exponia email/contacto/fecha de nacimiento
--    al anon key (RLS es row-level, no column-level). is_profile_public
--    ademas tenia DEFAULT true, haciendo publico a cada jugador nuevo.
drop policy if exists "Public read players safe" on public.players;
alter table public.players alter column is_profile_public set default false;

-- 2. sponsor_view_metrics: tenia RLS apagada -> lectura/escritura por cualquiera.
alter table public.sponsor_view_metrics enable row level security;

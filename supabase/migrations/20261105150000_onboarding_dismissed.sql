-- "Empieza aquí": se muestra hasta que el jugador lo salta. Las cuentas que ya
-- existen no lo ven; las fantasma (sin auth_user_id) lo verán al darse de alta.
alter table public.players add column if not exists onboarding_dismissed_at timestamptz;

update public.players
set onboarding_dismissed_at = now()
where auth_user_id is not null and onboarding_dismissed_at is null;

-- Permite volver a copiar la URL de una invitación activa. El token se guarda cifrado
-- con STORE_INVITE_TOKEN_KEY (solo en el servidor); token_hash sigue validando el enlace.
-- Null en los enlaces creados antes de esto: esos no se pueden recuperar.
alter table public.store_signup_invites add column token_encrypted text;

-- Las cuentas nuevas nacen con perfil público: es una plataforma de rankings. Ya no
-- expone datos personales: la policy que los filtraba se quitó en rls_hardening y
-- players solo se lee con players_read_own. No toca a quien hoy es privado.
alter table public.players alter column is_profile_public set default true;

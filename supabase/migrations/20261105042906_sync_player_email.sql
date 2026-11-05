-- La app encuentra al jugador por email, así que players.email debe seguir a
-- auth.users o el usuario queda sin acceso tras cambiar de correo. Si otro jugador
-- ya tiene ese email, el UNIQUE aborta y el cambio se rechaza entero.
create or replace function public.sync_player_email()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  update public.players set email = new.email where auth_user_id = new.id;
  return new;
end
$fn$;
revoke all on function public.sync_player_email() from public, anon, authenticated;

create or replace trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.sync_player_email();

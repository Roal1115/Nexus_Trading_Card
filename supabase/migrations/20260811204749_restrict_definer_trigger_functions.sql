-- Funciones SECURITY DEFINER de triggers: no deben ser llamables via RPC
-- por anon/authenticated. Los triggers siguen funcionando (corren como owner).
revoke execute on function public.fn_match_standalone_sessions_on_publish() from public, anon, authenticated;
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.notify_round_reported() from public, anon, authenticated;
revoke execute on function public.notify_schedule_changed() from public, anon, authenticated;
revoke execute on function public.notify_tournament_published() from public, anon, authenticated;

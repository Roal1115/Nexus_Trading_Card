-- Vistas SECURITY DEFINER -> invoker (advisor security_definer_view, nivel ERROR).
-- El backend usa service role y no se ve afectado.
alter view public.players_public set (security_invoker = true);
alter view public.public_players_view set (security_invoker = true);
alter view public.sponsor_metrics_current_month set (security_invoker = true);

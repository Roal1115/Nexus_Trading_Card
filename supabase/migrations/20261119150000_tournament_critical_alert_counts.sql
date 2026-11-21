-- Alertas críticas por torneo, para marcarlas en la lista del organizador sin abrir cada detalle.
-- Mismas dos reglas que el detalle (getOrganizerTournamentDetail):
--   1) otro torneo de la misma tienda, juego y fecha ya APPROVED o PUBLISHED;
--   2) jugadores de este torneo que aparecen en otro torneo del mismo juego el mismo día.
-- Solo se llama con service role desde server functions.
create or replace function public.tournament_critical_alert_counts(p_ids uuid[])
returns table (tournament_id uuid, critical_alerts integer)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    t.id,
    (
      select count(*)::int
      from public.tournaments d
      where d.store_id = t.store_id
        and d.game_id = t.game_id
        and d.tournament_date = t.tournament_date
        and d.id <> t.id
        and d.status in ('APPROVED', 'PUBLISHED')
    )
    +
    (
      select count(distinct r.player_id)::int
      from public.tournament_results r
      join public.tournaments o on o.id = r.tournament_id
      where o.game_id = t.game_id
        and o.tournament_date = t.tournament_date
        and o.id <> t.id
        and r.player_id in (
          select mine.player_id from public.tournament_results mine where mine.tournament_id = t.id
        )
    )
  from public.tournaments t
  where t.id = any (p_ids);
$$;

revoke execute on function public.tournament_critical_alert_counts(uuid[]) from public, anon, authenticated;

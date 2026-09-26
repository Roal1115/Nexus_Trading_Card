-- "I Was There" pasó de "jugó la primera temporada" a "jugó el evento
-- inaugural de CUALQUIER TCG en CUALQUIER tienda" — el primer torneo
-- publicado de cada combinación (store_id, game_id), no un único torneo
-- global ni ligado a season_id.
update public.achievement_definitions
set trigger_key = 'first_store_game_event', trigger_threshold = 1
where key = 'i_was_there';

create or replace function public.recompute_player_achievements(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_home_city text;
begin
  select s.city into v_home_city
  from public.players p
  join public.stores s on s.id = p.home_store_id
  where p.id = p_player_id;

  with
  base_results as (
    select
      tr.*,
      t.store_id, t.season_id, t.game_id, t.tournament_date, s.city, s.zone,
      round(
        (select max(tr2.match_points) from public.tournament_results tr2 where tr2.tournament_id = tr.tournament_id)
        / 3.0
      ) as inferred_total_rounds
    from public.tournament_results tr
    join public.tournaments t on t.id = tr.tournament_id
    join public.stores s on s.id = t.store_id
    where tr.player_id = p_player_id
      and t.status in ('APPROVED', 'PUBLISHED')
  ),
  derived as (
    select
      *,
      coalesce(wins, floor(coalesce(match_points, 0) / 3.0))::int as eff_wins,
      coalesce(
        losses,
        greatest(
          inferred_total_rounds
            - floor(coalesce(match_points, 0) / 3.0)
            - (case when coalesce(match_points, 0)::int % 3 = 1 then 1 else 0 end),
          0
        )
      )::int as eff_losses
    from base_results
  ),
  rounds as (
    select rr.*
    from public.tournament_round_results rr
    where rr.player_id = p_player_id and rr.is_bye = false
  ),
  streak_calc as (
    select coalesce(max(streak_len), 0) as max_streak
    from (
      select count(*) as streak_len
      from (
        select won_match,
               row_number() over (order by t.tournament_date, r.round_number)
                 - row_number() over (partition by won_match order by t.tournament_date, r.round_number) as grp
        from rounds r
        join public.tournaments t on t.id = r.tournament_id
        where r.won_match is not null
      ) x
      where won_match = true
      group by grp
    ) g
  ),
  active_regions_home_city as (
    select count(distinct zone) as n
    from public.stores
    where city = v_home_city and is_active = true and zone is not null
  ),
  -- Primer torneo publicado de cada combinación (store_id, game_id) —
  -- el "evento inaugural" de ese TCG en esa tienda.
  first_store_game_events as (
    select distinct on (t.store_id, t.game_id) t.id as tournament_id
    from public.tournaments t
    where t.status in ('APPROVED', 'PUBLISHED')
    order by t.store_id, t.game_id, t.tournament_date asc, t.created_at asc
  ),
  metrics as (
    select 'event_count' as metric_key, count(*)::numeric as metric_value from derived
    union all
    select 'career_match_wins', coalesce(sum(eff_wins), 0) from derived
    union all
    select 'career_top8', count(*) from derived where rank <= 8
    union all
    select 'career_top3', count(*) from derived where rank <= 3
    union all
    select 'career_event_wins', count(*) from derived where rank = 1
    union all
    select 'career_win_streak', max_streak from streak_calc
    union all
    select 'perfect_day_count', count(*) from derived where eff_losses = 0 and eff_wins >= 3
    union all
    select 'unique_leaders_used', count(distinct player_leader_id) from rounds where player_leader_id is not null
    union all
    select 'unique_leaders_with_top8', count(distinct rr.player_leader_id)
      from rounds rr join derived br on br.tournament_id = rr.tournament_id
      where br.rank <= 8 and rr.player_leader_id is not null
    union all
    select 'unique_leaders_with_event_win', count(distinct rr.player_leader_id)
      from rounds rr join derived br on br.tournament_id = rr.tournament_id
      where br.rank = 1 and rr.player_leader_id is not null
    union all
    select 'unique_stores_played', count(distinct store_id) from derived
    union all
    select 'unique_cities_played', count(distinct city) from derived
    union all
    select 'unique_city_regions_played', count(distinct zone) from derived where city = v_home_city and zone is not null
    union all
    select 'all_active_regions_in_home_city_played',
      case when (select n from active_regions_home_city) > 0
        and (select count(distinct zone) from derived where city = v_home_city and zone is not null)
          >= (select n from active_regions_home_city)
      then 1 else 0 end
    union all
    select 'seasons_participated', count(distinct season_id) from derived where season_id is not null
    union all
    select 'founding_player',
      case when exists (
        select 1 from derived br
        where br.season_id = (select id from public.seasons order by start_date asc limit 1)
      ) then 1 else 0 end
    union all
    select 'first_store_game_event',
      case when exists (
        select 1 from derived br
        join first_store_game_events f on f.tournament_id = br.tournament_id
      ) then 1 else 0 end
  )
  insert into public.player_achievements (player_id, achievement_key)
  select p_player_id, ad.key
  from public.achievement_definitions ad
  join metrics m on m.metric_key = ad.trigger_key
  where ad.trigger_threshold is not null
    and m.metric_value >= ad.trigger_threshold
  on conflict (player_id, achievement_key) do nothing;

  insert into public.player_achievements (player_id, achievement_key)
  select p_player_id, rc.key
  from public.achievement_definitions rc
  where rc.item_type = 'Road Completion'
    and not exists (
      select 1 from public.achievement_definitions base
      where base.road = rc.road and base.item_type = 'Achievement'
        and not exists (
          select 1 from public.player_achievements pa
          where pa.player_id = p_player_id and pa.achievement_key = base.key
        )
    )
  on conflict (player_id, achievement_key) do nothing;

  insert into public.player_achievements (player_id, achievement_key)
  select p_player_id, ad.key
  from public.achievement_definitions ad
  where ad.trigger_key = 'achievements_unlocked'
    and (select count(*) from public.player_achievements pa where pa.player_id = p_player_id) >= ad.trigger_threshold
  on conflict (player_id, achievement_key) do nothing;
end;
$$;

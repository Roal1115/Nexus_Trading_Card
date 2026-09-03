-- "Perfect Day" (terminar un torneo invicto) se sembró con trigger_key NULL
-- en la migración original — nunca se otorgaba sin importar el resultado
-- del jugador. Es calculable con lo que ya guarda tournament_results
-- (losses = 0), con un piso de wins >= 3 para no contar un torneo de 1-2
-- rondas como "perfecto".
update public.achievement_definitions
set trigger_key = 'perfect_day_count', trigger_threshold = 1
where key = 'perfect_day';

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
    select tr.*, t.store_id, t.season_id, t.game_id, t.tournament_date, s.city, s.zone
    from public.tournament_results tr
    join public.tournaments t on t.id = tr.tournament_id
    join public.stores s on s.id = t.store_id
    where tr.player_id = p_player_id
      and t.status in ('APPROVED', 'PUBLISHED')
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
  metrics as (
    select 'event_count' as metric_key, count(*)::numeric as metric_value from base_results
    union all
    select 'career_match_wins', count(*) from rounds where won_match = true
    union all
    select 'career_top8', count(*) from base_results where rank <= 8
    union all
    select 'career_top3', count(*) from base_results where rank <= 3
    union all
    select 'career_event_wins', count(*) from base_results where rank = 1
    union all
    select 'career_win_streak', max_streak from streak_calc
    union all
    select 'perfect_day_count', count(*) from base_results where losses = 0 and wins >= 3
    union all
    select 'unique_leaders_used', count(distinct player_leader_id) from rounds where player_leader_id is not null
    union all
    select 'unique_leaders_with_top8', count(distinct rr.player_leader_id)
      from rounds rr join base_results br on br.tournament_id = rr.tournament_id
      where br.rank <= 8 and rr.player_leader_id is not null
    union all
    select 'unique_leaders_with_event_win', count(distinct rr.player_leader_id)
      from rounds rr join base_results br on br.tournament_id = rr.tournament_id
      where br.rank = 1 and rr.player_leader_id is not null
    union all
    select 'unique_stores_played', count(distinct store_id) from base_results
    union all
    select 'unique_cities_played', count(distinct city) from base_results
    union all
    select 'unique_city_regions_played', count(distinct zone) from base_results where city = v_home_city and zone is not null
    union all
    select 'all_active_regions_in_home_city_played',
      case when (select n from active_regions_home_city) > 0
        and (select count(distinct zone) from base_results where city = v_home_city and zone is not null)
          >= (select n from active_regions_home_city)
      then 1 else 0 end
    union all
    select 'seasons_participated', count(distinct season_id) from base_results where season_id is not null
    union all
    select 'founding_player',
      case when exists (
        select 1 from base_results br
        where br.season_id = (select id from public.seasons order by start_date asc limit 1)
      ) then 1 else 0 end
    union all
    select 'i_was_there',
      case when exists (
        select 1 from base_results br
        where br.tournament_id = (select id from public.tournaments order by tournament_date asc, created_at asc limit 1)
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

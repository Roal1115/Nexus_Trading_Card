-- CSV-imported tournaments (tournaments.csv_url set) frequently only carry
-- match_points on tournament_results — wins/losses stay NULL because the
-- source CSV export (Melee/standings-only formats) doesn't include them.
-- The rest of the app already falls back to deriving wins/losses from
-- match_points (see nexus-player.functions.ts) — the achievement engine
-- did not, so "Perfect Day" and "First Victory" silently failed for any
-- CSV-only tournament (wins/losses NULL -> every threshold check involving
-- them evaluates to NULL, never TRUE). This wires the same derivation here.
--
-- career_match_wins is redefined to sum per-tournament win counts (real or
-- derived) from tournament_results instead of counting rows in
-- tournament_round_results — round-by-round data only exists for tournaments
-- run through the live Performance Tracker, not CSV imports, so the old
-- definition could never fire for CSV-only players. This is also a more
-- correct definition for "have you ever won a match", independent of how
-- the tournament was recorded.
--
-- career_win_streak, unique_leaders_used/with_top8/with_event_win still
-- require tournament_round_results (sequential per-round order / leader per
-- round) and are NOT fixable from aggregate CSV data — see audit notes.
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
      -- Rondas totales del torneo, inferidas del match_points más alto
      -- (misma convención que el resto de la app: 3 pts por victoria).
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
    select 'i_was_there',
      case when exists (
        select 1 from derived br
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

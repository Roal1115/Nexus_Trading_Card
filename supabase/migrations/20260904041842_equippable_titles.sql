-- Titles equipables: reward_type/reward_detail del catálogo son texto libre
-- ("Title: UNDEFEATED.", "VETERAN SEAL + ... + Title MCL VETERAN.") y no
-- alcanza para renderizar el title en el perfil. title_text guarda el string
-- limpio SOLO para los achievements cuyo reward incluye un Title equipable.

alter table public.achievement_definitions
  add column title_text text;

update public.achievement_definitions set title_text = 'REGULAR' where key = 'regular';
update public.achievement_definitions set title_text = 'IRONMAN' where key = 'ironman';
update public.achievement_definitions set title_text = 'MCL VETERAN' where key = 'veteran_seal';
update public.achievement_definitions set title_text = 'UNDEFEATED' where key = 'perfect_day';
update public.achievement_definitions set title_text = 'THE FINALIST' where key = 'national_finalist';
update public.achievement_definitions set title_text = 'MASTER' where key = 'champion_seal';
update public.achievement_definitions set title_text = 'VERSATILE' where key = 'versatile';
update public.achievement_definitions set title_text = 'SPECIALIST' where key = 'specialist';
update public.achievement_definitions set title_text = 'NOMAD' where key = 'nomad';
update public.achievement_definitions set title_text = 'ROAD WARRIOR' where key = 'road_warrior';
update public.achievement_definitions set title_text = 'SPORTSMAN' where key = 'sportsman';
update public.achievement_definitions set title_text = 'AMBASSADOR' where key = 'ambassador';
update public.achievement_definitions set title_text = 'MCL LEGEND' where key = 'mcl_legend';
update public.achievement_definitions set title_text = 'GIANT SLAYER' where key = 'david_and_goliath';
update public.achievement_definitions set title_text = 'THE USURPER' where key = 'the_usurper';
update public.achievement_definitions set title_text = 'THE INVADER' where key = 'home_invasion';
update public.achievement_definitions set title_text = 'BOUNTY HUNTER' where key = 'the_hunter';
update public.achievement_definitions set title_text = 'UNTOUCHABLE' where key = 'untouchable';

alter table public.players
  add column equipped_title_key text references public.achievement_definitions(key);

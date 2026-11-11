-- Sistema de Achievements (MCL Legacy System, Season I catalog).
-- achievement_definitions = catálogo estático (seed desde el CSV oficial).
-- player_achievements = desbloqueos por jugador.
-- trigger_key/trigger_threshold: solo se llenan para triggers calculables
-- con el schema actual (tournaments/tournament_results/tournament_round_results/
-- stores/seasons). El resto del catálogo queda con trigger_key NULL —
-- visible/documentado pero no auto-otorgable hasta que exista tracking nuevo
-- (commendations, referidos, playoffs regionales/nacionales, leader-por-evento).

create table public.achievement_definitions (
  key text primary key,
  road text not null,
  item_type text not null,
  name text not null,
  visibility text not null,
  requirement_text text not null,
  trigger_logic text not null,
  trigger_key text,
  trigger_threshold integer,
  tier text not null,
  base_lp integer not null default 0,
  reward_type text,
  reward_detail text,
  icon_direction text,
  road_progress text,
  availability text,
  notes text,
  sort_order integer not null
);

create table public.player_achievements (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  achievement_key text not null references public.achievement_definitions(key) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unique (player_id, achievement_key)
);

create index player_achievements_player_id_idx on public.player_achievements(player_id);

alter table public.achievement_definitions enable row level security;
alter table public.player_achievements enable row level security;

-- Catálogo es estático y no competitivamente sensible (requisitos de los
-- Secret/Classified se ocultan a nivel de server function, no de RLS).
create policy "achievement_definitions_public_read"
  on public.achievement_definitions for select
  using (true);

create policy "player_achievements_public_read"
  on public.player_achievements for select
  using (
    exists (
      select 1 from public.players p
      where p.id = player_achievements.player_id
        and (p.is_profile_public is null or p.is_profile_public = true)
    )
    or player_id = (select id from public.players where auth_user_id = auth.uid())
  );

-- Seed: catálogo canónico Season I (Roads I-VII + Secret/Classified).
insert into public.achievement_definitions
  (key, road, item_type, name, visibility, requirement_text, trigger_logic, trigger_key, trigger_threshold, tier, base_lp, reward_type, reward_detail, icon_direction, road_progress, availability, notes, sort_order)
values
  ('welcome_to_mcl','I. The Journey','Achievement','Welcome to MCL','Public','Participar en el primer evento oficial MCL.','event_count >= 1','event_count',1,'Bronze',10,'Badge','Badge base de ingreso MCL.','Escudo MCL simple en bronce','1/7','Season I / Evergreen',null,1),
  ('getting_started','I. The Journey','Achievement','Getting Started','Public','Participar en 5 eventos oficiales MCL.','event_count >= 5','event_count',5,'Bronze',10,'Nameplate','Nameplate básico desbloqueable.','Rail grafito + detalle bronce','2/7','Season I / Evergreen',null,2),
  ('regular','I. The Journey','Achievement','Regular','Public','Participar en 10 eventos oficiales MCL.','event_count >= 10','event_count',10,'Silver',25,'Title','Title equipable: REGULAR.','Tipografía deportiva + plata','3/7','Season I / Evergreen',null,3),
  ('committed','I. The Journey','Achievement','Committed','Public','Participar en 20 eventos oficiales MCL.','event_count >= 20','event_count',20,'Silver',25,'Animated Badge','Badge animado de constancia.','Escudo con pulso plateado','4/7','Season I / Evergreen',null,4),
  ('league_veteran','I. The Journey','Achievement','League Veteran','Public','Participar en 40 eventos oficiales MCL.','event_count >= 40','event_count',40,'Gold',60,'Profile Frame','Veteran Frame.','Marco grafito con rails Master Gold','5/7','Season I / Evergreen',null,5),
  ('ironman','I. The Journey','Achievement','Ironman','Public','Participar en 75 eventos oficiales MCL.','event_count >= 75','event_count',75,'Gold',60,'Title','Title equipable: IRONMAN.','Emblema metálico / yunque estilizado','6/7','Season I / Evergreen',null,6),
  ('centurion','I. The Journey','Achievement','Centurion','Public','Participar en 100 eventos oficiales MCL.','event_count >= 100','event_count',100,'Platinum',150,'Animated Crest','Century Crest animado.','Escudo con numeral C','7/7','Season I / Evergreen',null,7),
  ('veteran_seal','I. The Journey','Road Completion','Veteran Seal','Public','Completar todos los achievements base de The Journey.','journey_base_complete = TRUE',null,null,'Road Bonus',75,'Seal + Frame + Title','VETERAN SEAL + Veteran Frame + Title MCL VETERAN.','Sello hexagonal negro/plata/oro','COMPLETE','Season I / Evergreen','Bonus de Road; se otorga una sola vez.',8),

  ('first_victory','II. The Competitor','Achievement','First Victory','Public','Obtener la primera victoria oficial en MCL.','career_match_wins >= 1','career_match_wins',1,'Bronze',10,'Badge','Victory Badge.','Estrella MCL + marca de victoria','1/9','Season I / Evergreen',null,10),
  ('on_the_board','II. The Competitor','Achievement','On the Board','Public','Lograr el primer Top 8 en un evento oficial.','career_top8 >= 1','career_top8',1,'Bronze',10,'Badge','Top 8 Badge.','Data chip #8 + estrella','2/9','Season I / Evergreen',null,11),
  ('podium_finish','II. The Competitor','Achievement','Podium Finish','Public','Terminar Top 3 en un evento oficial.','career_top3 >= 1','career_top3',1,'Silver',25,'Nameplate','Podium Nameplate.','Podio angular plateado','3/9','Season I / Evergreen',null,12),
  ('perfect_day','II. The Competitor','Achievement','Perfect Day','Public','Terminar un torneo invicto.','event_losses = 0 AND event_completed = TRUE AND rounds_played >= min_valid_rounds',null,null,'Silver',25,'Title','Title: UNDEFEATED.','Estrella limpia + 0L','4/9','Season I / Evergreen',null,13),
  ('hot_streak','II. The Competitor','Achievement','Hot Streak','Public','Ganar 5 partidas consecutivas.','career_win_streak >= 5','career_win_streak',5,'Silver',25,'Badge','Flame Badge.','Flama geométrica plata','5/9','Season I / Evergreen',null,14),
  ('on_fire','II. The Competitor','Achievement','On Fire','Public','Ganar 10 partidas consecutivas.','career_win_streak >= 10','career_win_streak',10,'Gold',60,'Animated Badge','Animated Flame Badge.','Flama Master Gold animada','6/9','Season I / Evergreen',null,15),
  ('regional_qualifier','II. The Competitor','Achievement','Regional Qualifier','Public','Clasificar al City/Regional Playoff.','qualified_city_playoff = TRUE',null,null,'Gold',60,'Regional Crest','Crest de ciudad/región.','Escudo territorial MCL','7/9','Season I / Evergreen',null,16),
  ('regional_elite','II. The Competitor','Achievement','Regional Elite','Public','Terminar Top 8 del City/Regional Playoff.','city_playoff_finish <= 8',null,null,'Gold',60,'Profile Frame','Elite Regional Frame.','Marco plata + rail territorial','8/9','Season I / Evergreen',null,17),
  ('national_qualifier','II. The Competitor','Achievement','National Qualifier','Public','Clasificar al Campeonato Nacional MCL.','qualified_national = TRUE',null,null,'Platinum',150,'National Crest','National Qualifier Crest.','Escudo MCL + estrella nacional','9/9','Season I / Evergreen',null,18),
  ('elite_competitor_seal','II. The Competitor','Road Completion','Elite Competitor Seal','Public','Completar todos los achievements base de The Competitor.','competitor_base_complete = TRUE',null,null,'Road Bonus',100,'Seal + Title + Showcase Slot','ELITE COMPETITOR SEAL + Title + 1 Stat Showcase adicional.','Sello acero/oro con doble estrella','COMPLETE','Season I / Evergreen','Bonus de Road; una sola vez.',19),

  ('local_champion','III. The Champion','Achievement','Local Champion','Public','Ganar un evento oficial MCL.','career_event_wins >= 1','career_event_wins',1,'Silver',25,'Champion Badge','Badge de campeón local.','Corona pequeña sobre escudo','1/9','Season I / Evergreen',null,20),
  ('repeat_champion','III. The Champion','Achievement','Repeat Champion','Public','Ganar 3 eventos oficiales MCL.','career_event_wins >= 3','career_event_wins',3,'Gold',60,'Nameplate','Gold Champion Nameplate.','Rail Master Gold + III','2/9','Season I / Evergreen',null,21),
  ('dominant','III. The Champion','Achievement','Dominant','Public','Ganar 5 eventos oficiales MCL.','career_event_wins >= 5','career_event_wins',5,'Gold',60,'Animated Badge','Animated Champion Badge.','Corona + estrella animadas','3/9','Season I / Evergreen',null,22),
  ('back_to_back','III. The Champion','Achievement','Back to Back','Public','Ganar dos eventos MCL consecutivos en los que participa.','consecutive_event_wins >= 2',null,null,'Gold',60,'Profile Border','Back-to-Back Border.','Doble corona angular','4/9','Season I / Evergreen',null,23),
  ('city_finalist','III. The Champion','Achievement','City Finalist','Public','Llegar a la final del City Championship.','city_championship_finish <= 2',null,null,'Gold',60,'City Finalist Crest','Crest de finalista de ciudad.','Escudo de ciudad + II','5/9','Season I / Evergreen',null,24),
  ('city_champion','III. The Champion','Achievement','City Champion','Public','Ganar el City Championship.','city_championship_finish = 1',null,null,'Platinum',150,'Profile Frame','City Champion Frame.','Marco territorial oro/plata','6/9','Season I / Evergreen',null,25),
  ('national_top_16','III. The Champion','Achievement','National Top 16','Public','Terminar Top 16 en el Nacional MCL.','national_finish <= 16',null,null,'Gold',60,'National Elite Badge','Top 16 National Badge.','Numeral 16 + estrella','7/9','Season I / Evergreen',null,26),
  ('national_top_8','III. The Champion','Achievement','National Top 8','Public','Terminar Top 8 en el Nacional MCL.','national_finish <= 8',null,null,'Platinum',150,'Premium Frame','National Top 8 Frame.','Marco platinum + gold rail','8/9','Season I / Evergreen',null,27),
  ('national_finalist','III. The Champion','Achievement','National Finalist','Public','Llegar a la final del Nacional MCL.','national_finish <= 2',null,null,'Platinum',150,'Title + Crest','Title: THE FINALIST + Finalist Crest.','Corona abierta + II','9/9','Season I / Evergreen',null,28),
  ('mcl_champion','III. The Champion','Achievement','MCL Champion','Public','Ganar el Campeonato Nacional MCL.','national_finish = 1',null,null,'Legacy',250,'Championship Package','Champion Frame animado + Gold Username + Crown + Exclusive Nameplate + Entrance Effect + Champion Seal + número histórico.','Corona MCL completa, negro/oro, serial #NNN','MASTER','Season I / Evergreen','El número histórico de campeón nunca cambia.',29),
  ('champion_seal','III. The Champion','Road Completion','Champion Seal','Public','Completar la Road base de Champion, incluyendo MCL Champion.','champion_base_complete = TRUE',null,null,'Road Bonus',150,'Seal + Title','CHAMPION SEAL + Title MASTER.','Sello ceremonial negro/oro','COMPLETE','Season I / Evergreen','Road deliberadamente difícil; bonus una sola vez.',30),

  ('experimenter','IV. The Specialist','Achievement','Experimenter','Public','Competir oficialmente con 3 Leaders distintos.','unique_leaders_used >= 3','unique_leaders_used',3,'Bronze',10,'Badge','Experimenter Badge.','Tres cartas geométricas','1/7','Season I / Evergreen',null,31),
  ('versatile','IV. The Specialist','Achievement','Versatile','Public','Competir oficialmente con 5 Leaders distintos.','unique_leaders_used >= 5','unique_leaders_used',5,'Silver',25,'Title','Title: VERSATILE.','Abanico de 5 cartas','2/7','Season I / Evergreen',null,32),
  ('loyalist','IV. The Specialist','Achievement','Loyalist','Public','Jugar 10 torneos con el mismo Leader.','max_events_with_same_leader >= 10',null,null,'Silver',25,'Crest','Loyalty Crest.','Escudo + una carta central','3/7','Season I / Evergreen',null,33),
  ('specialist','IV. The Specialist','Achievement','Specialist','Public','Jugar 20 torneos con el mismo Leader.','max_events_with_same_leader >= 20',null,null,'Gold',60,'Title','Title: SPECIALIST.','Carta central + corona pequeña','4/7','Season I / Evergreen',null,34),
  ('proven_specialist','IV. The Specialist','Achievement','Proven Specialist','Public','Conseguir 5 Top 8 con el mismo Leader.','max_top8_with_same_leader >= 5',null,null,'Gold',60,'Profile Frame','Specialist Frame.','Marco técnico plata/oro','5/7','Season I / Evergreen',null,35),
  ('master_of_many','IV. The Specialist','Achievement','Master of Many','Public','Conseguir Top 8 con 5 Leaders distintos.','unique_leaders_with_top8 >= 5','unique_leaders_with_top8',5,'Gold',60,'Animated Badge','Multi-Mastery Badge.','Cinco cartas orbitando estrella','6/7','Season I / Evergreen',null,36),
  ('master_tactician','IV. The Specialist','Achievement','Master Tactician','Public','Ganar eventos con 3 Leaders distintos.','unique_leaders_with_event_win >= 3','unique_leaders_with_event_win',3,'Platinum',150,'Nameplate','Tactician Nameplate.','Tablero/retícula estratégica','7/7','Season I / Evergreen',null,37),
  ('master_tactician_seal','IV. The Specialist','Road Completion','Master Tactician Seal','Public','Completar todos los achievements base de The Specialist.','specialist_base_complete = TRUE',null,null,'Road Bonus',100,'Seal','MASTER TACTICIAN SEAL.','Sello geométrico con 3 cartas','COMPLETE','Season I / Evergreen','No usar artwork/licencias de terceros salvo autorización.',38),

  ('visitor','V. The Explorer','Achievement','Visitor','Public','Competir en 2 tiendas MCL distintas.','unique_stores_played >= 2','unique_stores_played',2,'Bronze',10,'Badge','Compass Badge.','Brújula mínima','1/7','Season I / Evergreen',null,39),
  ('explorer','V. The Explorer','Achievement','Explorer','Public','Competir en 5 tiendas MCL distintas.','unique_stores_played >= 5','unique_stores_played',5,'Silver',25,'Badge','Explorer Badge.','Brújula plata + 5 puntos','2/7','Season I / Evergreen',null,40),
  ('nomad','V. The Explorer','Achievement','Nomad','Public','Competir en 10 tiendas MCL distintas.','unique_stores_played >= 10','unique_stores_played',10,'Gold',60,'Title','Title: NOMAD.','Brújula Master Gold','3/7','Season I / Evergreen',null,41),
  ('regional_traveler','V. The Explorer','Achievement','Regional Traveler','Public','Competir en 3 regiones distintas de su ciudad.','unique_city_regions_played >= 3','unique_city_regions_played',3,'Silver',25,'Regional Crest','Regional Traveler Crest.','Mapa abstracto de región','4/7','Season I / Evergreen',null,42),
  ('city_explorer','V. The Explorer','Achievement','City Explorer','Public','Competir en todas las regiones activas de su ciudad.','all_active_regions_in_home_city_played = TRUE','all_active_regions_in_home_city_played',1,'Gold',60,'City Crest','City Explorer Crest.','Mapa territorial completo','5/7','Season I / Evergreen',null,43),
  ('road_warrior','V. The Explorer','Achievement','Road Warrior','Public','Competir oficialmente en 2 ciudades MCL.','unique_cities_played >= 2','unique_cities_played',2,'Gold',60,'Title','Title: ROAD WARRIOR.','Brújula + doble waypoint','6/7','Season I / Evergreen',null,44),
  ('national_traveler','V. The Explorer','Achievement','National Traveler','Public','Competir oficialmente en 5 ciudades MCL.','unique_cities_played >= 5','unique_cities_played',5,'Platinum',150,'Animated Crest','National Traveler Crest.','Brújula animada con 5 nodos','7/7','Season I / Evergreen',null,45),
  ('road_warrior_seal','V. The Explorer','Road Completion','Road Warrior Seal','Public','Completar todos los achievements base de The Explorer.','explorer_base_complete = TRUE',null,null,'Road Bonus',100,'Seal + Profile Theme','ROAD WARRIOR SEAL + Traveler Profile Theme.','Sello brújula negro/oro','COMPLETE','Season I / Evergreen','Mantener su peso por debajo de Champion para no premiar poder adquisitivo por encima del mérito.',46),

  ('good_game','VI. The Community','Achievement','Good Game','Public','Recibir commendations de 10 rivales únicos.','unique_opponents_commending >= 10',null,null,'Bronze',10,'Badge','GG Badge.','Handshake/escudo minimalista','1/6','Season I / Evergreen',null,47),
  ('respected','VI. The Community','Achievement','Respected','Public','Recibir commendations de 25 rivales únicos.','unique_opponents_commending >= 25',null,null,'Silver',25,'Crest','Silver Laurel.','Laurel plata','2/6','Season I / Evergreen',null,48),
  ('sportsman','VI. The Community','Achievement','Sportsman','Public','Recibir commendations de 50 rivales únicos.','unique_opponents_commending >= 50',null,null,'Gold',60,'Title','Title: SPORTSMAN.','Laurel oro + escudo','3/6','Season I / Evergreen',null,49),
  ('recruiter','VI. The Community','Achievement','Recruiter','Public','1 jugador referido completa su primer evento MCL.','validated_referrals_completed_first_event >= 1',null,null,'Bronze',10,'Badge','Recruiter Badge.','Dos nodos conectados','4/6','Season I / Evergreen',null,50),
  ('community_builder','VI. The Community','Achievement','Community Builder','Public','5 jugadores referidos completan su primer evento MCL.','validated_referrals_completed_first_event >= 5',null,null,'Gold',60,'Profile Frame','Community Builder Frame.','Red de 5 nodos','5/6','Season I / Evergreen',null,51),
  ('ambassador','VI. The Community','Achievement','Ambassador','Public','10 jugadores referidos válidos completan su primer evento MCL.','validated_referrals_completed_first_event >= 10',null,null,'Gold',60,'Title','Title: AMBASSADOR.','Escudo + señal/onda','6/6','Season I / Evergreen',null,52),
  ('guardian','VI. The Community','Achievement','Guardian','Curated / Public after award','Reconocimiento excepcional de sportsmanship validado por MCL.','manual_award_guardian = TRUE after documented review',null,null,'Platinum',150,'Guardian Seal','Guardian Seal + Guardian Frame.','Escudo protector platinum/oro','SPECIAL','Season I / Evergreen','No se obtiene por votación simple; requiere validación documentada de MCL.',53),
  ('guardian_road_seal','VI. The Community','Road Completion','Guardian Road Seal','Public','Completar la Road base de Community y recibir Guardian.','community_base_complete = TRUE',null,null,'Road Bonus',75,'Seal + Frame','GUARDIAN ROAD SEAL + Guardian Frame.','Sello laurel/escudo','COMPLETE','Season I / Evergreen','Bonus una sola vez.',54),

  ('founding_player','VII. The Legacy','Achievement','Founding Player','Public / Limited','Participar en la Founding Season de MCL.','season_id = 1 AND event_count_season >= 1','founding_player',1,'Gold',60,'Legacy Badge','Permanent Founding Player Badge.','FOUNDING 2027 + escudo','FOUNDING','Season I / Evergreen',null,55),
  ('season_complete','VII. The Legacy','Achievement','Season Complete','Public / Seasonal','Completar una temporada MCL válida.','season_completed = TRUE',null,null,'Silver',25,'Season Crest','Crest exclusivo de la temporada.','Numeral de temporada + estrella','SEASONAL','Season I / Evergreen','Crear un ID distinto por temporada.',56),
  ('veteran_ii','VII. The Legacy','Achievement','Veteran II','Public','Participar en 2 temporadas MCL.','seasons_participated >= 2','seasons_participated',2,'Silver',25,'Legacy Mark','Marca romana II.','II + rail plata','CAREER','Season I / Evergreen',null,57),
  ('three_seasons','VII. The Legacy','Achievement','Three Seasons','Public','Participar en 3 temporadas MCL.','seasons_participated >= 3','seasons_participated',3,'Gold',60,'Legacy Mark','Marca romana III.','III + Master Gold','CAREER','Season I / Evergreen',null,58),
  ('veteran_v','VII. The Legacy','Achievement','Veteran V','Public','Participar en 5 temporadas MCL.','seasons_participated >= 5','seasons_participated',5,'Platinum',150,'Legacy Frame','V Legacy Frame.','V dentro de escudo platinum','CAREER','Season I / Evergreen',null,59),
  ('mcl_legend','VII. The Legacy','Achievement','MCL Legend','Public','Participar en 10 temporadas MCL.','seasons_participated >= 10','seasons_participated',10,'Legacy',250,'Title + Crest','Title: MCL LEGEND + X Legacy Crest.','X ceremonial negro/oro','CAREER','Season I / Evergreen',null,60),
  ('national_pioneer','VII. The Legacy','Achievement','National Pioneer','Public / Limited','Participar en el primer Campeonato Nacional de MCL.','national_edition = 1 AND qualified_national = TRUE',null,null,'Gold',60,'Legacy Badge','Founding Nationals Badge.','NATIONAL I + estrella','HISTORICAL','Season I / Evergreen',null,61),
  ('first_among_masters','VII. The Legacy','Achievement','First Among Masters','Classified / Historical','Ser el primer jugador de la historia en conseguir un hito mayor definido por MCL.','historical_first_flag = TRUE for eligible milestone',null,null,'Legacy',250,'Serialized Badge','Badge serializado #001 del hito.','#001 + corona/estrella','HISTORICAL','Season I / Evergreen','No repetible para el mismo hito.',62),
  ('the_collector','VII. The Legacy','Achievement','The Collector','Secret','Desbloquear 25 achievements.','achievements_unlocked >= 25','achievements_unlocked',25,'Silver',25,'Showcase Slot','+1 Achievement Showcase Slot.','Vitrina/3 slots','META','Season I / Evergreen',null,63),
  ('achievement_hunter','VII. The Legacy','Achievement','Achievement Hunter','Secret','Desbloquear 50 achievements.','achievements_unlocked >= 50','achievements_unlocked',50,'Gold',60,'Showcase Upgrade','Gold Achievement Showcase.','Vitrina oro','META','Season I / Evergreen',null,64),
  ('completionist','VII. The Legacy','Achievement','Completionist','Secret / Seasonal','Conseguir todos los achievements públicos definidos para una temporada.','all_public_season_achievements_complete = TRUE',null,null,'Platinum',150,'Platinum Trophy','Platinum Completionist Trophy + Profile accent.','Trofeo platinum/oro','META','Season I / Evergreen',null,65),

  ('david_and_goliath','II. The Competitor','Secret Achievement','David & Goliath','Secret','Requisito oculto.','player_rank > 50 AND defeated_opponent_rank = 1',null,null,'Gold',60,'Title','GIANT SLAYER','Corona quebrada / escala','SECRET','Season I / Limited where applicable','Mantener requisito oculto en UI hasta desbloqueo; Classified no aparece en catálogo.',66),
  ('from_the_ashes','II. The Competitor','Secret Achievement','From the Ashes','Secret','Requisito oculto.','lost_round_1 = TRUE AND event_finish = 1',null,null,'Gold',60,'Animated Badge','Phoenix Badge animado','Fénix geométrico MCL','SECRET','Season I / Limited where applicable','Mantener requisito oculto en UI hasta desbloqueo; Classified no aparece en catálogo.',67),
  ('the_usurper','II. The Competitor','Secret Achievement','The Usurper','Classified','No aparece antes de desbloquearse.','defeated_rank_1 = TRUE AND later_reached_rank_1 = TRUE',null,null,'Platinum',150,'Title + Nameplate','THE USURPER + exclusive nameplate','Corona desplazada + #1','SECRET','Season I / Limited where applicable','Mantener requisito oculto en UI hasta desbloqueo; Classified no aparece en catálogo.',68),
  ('home_invasion','V. The Explorer','Secret Achievement','Home Invasion','Secret','Requisito oculto.','first_visit_to_store = TRUE AND event_finish = 1',null,null,'Silver',25,'Title','THE INVADER','Waypoint + corona','SECRET','Season I / Limited where applicable','Mantener requisito oculto en UI hasta desbloqueo; Classified no aparece en catálogo.',69),
  ('last_chance','II. The Competitor','Secret Achievement','Last Chance','Secret','Requisito oculto.','qualified_playoff_on_last_eligible_event = TRUE',null,null,'Gold',60,'Animated Badge','Last Chance Badge','Reloj/último tick + estrella','SECRET','Season I / Limited where applicable','Mantener requisito oculto en UI hasta desbloqueo; Classified no aparece en catálogo.',70),
  ('against_all_odds','II. The Competitor','Secret Achievement','Against All Odds','Secret','Requisito oculto.','starting_rank > 100 AND event_finish = 1',null,null,'Gold',60,'Crest','Underdog Crest','#100→#1','SECRET','Season I / Limited where applicable','Mantener requisito oculto en UI hasta desbloqueo; Classified no aparece en catálogo.',71),
  ('the_hunter','II. The Competitor','Secret Achievement','The Hunter','Secret','Requisito oculto.','unique_top10_players_defeated >= 3',null,null,'Gold',60,'Title','BOUNTY HUNTER','Tres targets/estrellas','SECRET','Season I / Limited where applicable','Mantener requisito oculto en UI hasta desbloqueo; Classified no aparece en catálogo.',72),
  ('nemesis','II. The Competitor','Secret Achievement','Nemesis','Secret','Requisito oculto.','wins_vs_same_opponent_across_distinct_events >= 5',null,null,'Gold',60,'Rivalry Badge','Nemesis / Rivalry Badge','Dos escudos enfrentados','SECRET','Season I / Limited where applicable','Mantener requisito oculto en UI hasta desbloqueo; Classified no aparece en catálogo.',73),
  ('globetrotter','V. The Explorer','Secret Achievement','Globetrotter','Secret','Requisito oculto.','unique_cities_with_event_win >= 3',null,null,'Platinum',150,'Animated Badge','Globetrotter Badge','Brújula + tres coronas','SECRET','Season I / Limited where applicable','Mantener requisito oculto en UI hasta desbloqueo; Classified no aparece en catálogo.',74),
  ('perfect_storm','II. The Competitor','Secret Achievement','Perfect Storm','Secret','Requisito oculto.','event_finish = 1 AND losses = 0 AND rounds_played >= 5',null,null,'Gold',60,'Profile Effect','Storm Profile Effect','Tormenta angular / estrella central','SECRET','Season I / Limited where applicable','Mantener requisito oculto en UI hasta desbloqueo; Classified no aparece en catálogo.',75),
  ('king_slayer','II. The Competitor','Secret Achievement','King Slayer','Secret','Requisito oculto.','defeated_reigning_national_champion = TRUE',null,null,'Gold',60,'Badge','Crown Breaker Badge','Corona partida','SECRET','Season I / Limited where applicable','Mantener requisito oculto en UI hasta desbloqueo; Classified no aparece en catálogo.',76),
  ('untouchable','II. The Competitor','Secret Achievement','Untouchable','Classified','No aparece antes de desbloquearse.','career_win_streak >= 15','career_win_streak',15,'Platinum',150,'Title + Username Effect','UNTOUCHABLE + Onyx/Gold effect','Escudo intacto + XV','SECRET','Season I / Limited where applicable','Mantener requisito oculto en UI hasta desbloqueo; Classified no aparece en catálogo.',77),
  ('i_was_there','VII. The Legacy','Secret Achievement','I Was There','Secret / Limited','Requisito oculto.','participated_in_first_official_mcl_event = TRUE','i_was_there',1,'Gold',60,'Permanent Legacy Badge','I WAS THERE badge','Fecha inaugural + estrella','SECRET','Season I / Limited where applicable','Mantener requisito oculto en UI hasta desbloqueo; Classified no aparece en catálogo.',78);

-- Recalcula y otorga (idempotente, ON CONFLICT DO NOTHING) los achievements
-- que son calculables desde el schema actual. Se corre on-demand al ver el
-- perfil/hub del jugador — el volumen actual (~20 torneos, ~80 jugadores) lo
-- hace barato; si el catálogo crece mucho, mover a un cron/trigger.
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

  -- Road completion: se otorga cuando el jugador ya tiene TODOS los
  -- achievements base (item_type = 'Achievement') de esa Road. Roads con
  -- achievements aún no calculables (Champion, Community, Specialist
  -- completos) nunca cumplen esta condición hoy — correcto, no un bug.
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

  -- Meta achievements (Collector / Achievement Hunter): dependen del total
  -- ya desbloqueado por los dos pasos anteriores.
  insert into public.player_achievements (player_id, achievement_key)
  select p_player_id, ad.key
  from public.achievement_definitions ad
  where ad.trigger_key = 'achievements_unlocked'
    and (select count(*) from public.player_achievements pa where pa.player_id = p_player_id) >= ad.trigger_threshold
  on conflict (player_id, achievement_key) do nothing;
end;
$$;

grant execute on function public.recompute_player_achievements(uuid) to authenticated, anon, service_role;

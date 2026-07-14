create extension if not exists "pg_trgm" with schema "public";

alter table "public"."tournament_results" drop constraint "tournament_results_points_earned_check";

alter table "public"."tournaments" drop constraint "tournaments_qualifying_month_check";

alter table "public"."tournaments" drop constraint "tournaments_qualifying_semester_check";

alter table "public"."leaderboard_snapshots" drop constraint "leaderboard_snapshots_store_id_fkey";

alter table "public"."tournament_results" drop constraint "tournament_results_player_id_fkey";

alter table "public"."tournaments" drop constraint "tournaments_game_id_fkey";

alter table "public"."tournaments" drop constraint "tournaments_store_id_fkey";

drop index if exists "public"."idx_lb_query";

drop index if exists "public"."idx_tournaments_year_month";

drop index if exists "public"."idx_tournaments_year_sem";

alter table "public"."tournaments" alter column "status" drop default;

alter type "public"."timeframe_type" rename to "timeframe_type__old_version_to_be_dropped";

create type "public"."timeframe_type" as enum ('MONTH', 'SEMESTER', 'YEAR', 'ALL_TIME', 'MONTHLY', 'SEMESTRAL');

alter type "public"."tournament_status" rename to "tournament_status__old_version_to_be_dropped";

create type "public"."tournament_status" as enum ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'CANCELLED', 'UNPUBLISHED');


  create table "public"."ad_metrics" (
    "id" uuid not null default gen_random_uuid(),
    "total_views" integer not null default 0,
    "total_cycles" integer not null default 0,
    "current_sponsor_id" uuid,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."ad_metrics" enable row level security;


  create table "public"."admin_audit_log" (
    "id" uuid not null default gen_random_uuid(),
    "actor_id" uuid not null,
    "actor_role" text not null,
    "action" text not null,
    "target_type" text not null,
    "target_id" uuid,
    "target_label" text,
    "metadata" jsonb,
    "created_at" timestamp with time zone not null default now(),
    "actor_tag" text not null default ''::text
      );


alter table "public"."admin_audit_log" enable row level security;


  create table "public"."deck_identifiers" (
    "id" uuid not null default gen_random_uuid(),
    "game_id" uuid not null,
    "identifier_type" text not null,
    "source" text not null,
    "card_set_id" text,
    "card_name" text not null,
    "base_name" text not null,
    "colors" text[],
    "card_image" text,
    "card_image_id" text,
    "set_code" text,
    "set_name" text,
    "rarity" text,
    "is_active" boolean not null default true,
    "created_by" uuid,
    "synced_at" timestamp with time zone,
    "created_at" timestamp with time zone default now(),
    "api_source" text,
    "canonical_leader_id" uuid
      );


alter table "public"."deck_identifiers" enable row level security;


  create table "public"."deck_identifiers_sync_log" (
    "id" uuid not null default gen_random_uuid(),
    "game_id" uuid not null,
    "synced_at" timestamp with time zone not null default now(),
    "leaders_added" integer not null default 0,
    "leaders_updated" integer not null default 0,
    "leaders_deactivated" integer not null default 0,
    "status" text not null,
    "error_message" text
      );


alter table "public"."deck_identifiers_sync_log" enable row level security;


  create table "public"."manager_games" (
    "id" uuid not null default gen_random_uuid(),
    "player_id" uuid not null,
    "game_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."manager_games" enable row level security;


  create table "public"."player_games" (
    "id" uuid not null default gen_random_uuid(),
    "player_id" uuid not null,
    "game_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."player_games" enable row level security;


  create table "public"."player_tcg_ids" (
    "id" uuid not null default gen_random_uuid(),
    "player_id" uuid not null,
    "game_id" uuid not null,
    "tcg_user_id" text not null,
    "created_at" timestamp with time zone not null default now(),
    "tcg_user_id_normalized" text
      );


alter table "public"."player_tcg_ids" enable row level security;


  create table "public"."round_appeals" (
    "id" uuid not null default gen_random_uuid(),
    "tournament_id" uuid not null,
    "original_round_id" uuid not null,
    "appellant_player_id" uuid not null,
    "store_id" uuid not null,
    "round_number" integer not null,
    "original_player_leader_id" uuid,
    "original_opponent_leader_id" uuid,
    "original_won_match" boolean,
    "original_won_die_roll" boolean,
    "original_turn_order" text,
    "proposed_player_leader_id" uuid,
    "proposed_opponent_leader_id" uuid,
    "proposed_won_match" boolean,
    "proposed_won_die_roll" boolean,
    "proposed_turn_order" text,
    "status" text not null default 'pending'::text,
    "resolution" text,
    "resolved_by" uuid,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."round_appeals" enable row level security;


  create table "public"."seasons" (
    "id" uuid not null default gen_random_uuid(),
    "name" character varying(100) not null,
    "slug" character varying(60) not null,
    "start_date" date not null,
    "end_date" date not null,
    "is_active" boolean not null default false,
    "status" text not null default 'UPCOMING'::text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."seasons" enable row level security;


  create table "public"."session_link_events" (
    "id" uuid not null default gen_random_uuid(),
    "session_id" uuid not null,
    "event_type" text not null,
    "tournament_id" uuid,
    "actor_player_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."session_link_events" enable row level security;


  create table "public"."sponsor_view_metrics" (
    "id" uuid not null default gen_random_uuid(),
    "sponsor_id" uuid not null,
    "views_count" integer not null default 0,
    "month_year" text not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "cycles_count" integer not null default 0
      );



  create table "public"."sponsors" (
    "id" uuid not null default gen_random_uuid(),
    "name" character varying(100) not null,
    "priority_rank" integer not null,
    "view_limit" integer not null default 500,
    "views_count" integer not null default 0,
    "cycles_count" integer not null default 0,
    "is_active" boolean not null default true,
    "logo_url" text,
    "vertical_url" text,
    "horizontal_url" text,
    "created_at" timestamp with time zone not null default now(),
    "carousel_url" text,
    "display_order" integer default 0
      );


alter table "public"."sponsors" enable row level security;


  create table "public"."standalone_round_results" (
    "id" uuid not null default gen_random_uuid(),
    "session_id" uuid not null,
    "player_id" uuid not null,
    "opponent_player_id" uuid,
    "round_number" smallint not null,
    "is_bye" boolean not null default false,
    "player_leader_id" uuid,
    "opponent_leader_id" uuid,
    "won_die_roll" boolean,
    "turn_order" text,
    "won_match" boolean,
    "notes" text,
    "is_auto_populated" boolean not null default false,
    "status" text not null default 'confirmed'::text,
    "reporter_player_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."standalone_round_results" enable row level security;


  create table "public"."standalone_sessions" (
    "id" uuid not null default gen_random_uuid(),
    "player_id" uuid not null,
    "game_id" uuid not null,
    "session_type" text not null,
    "name" text not null,
    "session_date" date,
    "session_time" time without time zone,
    "store_id" uuid,
    "tournament_id" uuid,
    "status" text not null default 'unlinked'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "player_leader_id" uuid
      );


alter table "public"."standalone_sessions" enable row level security;


  create table "public"."store_analytics_settings" (
    "id" uuid not null default gen_random_uuid(),
    "store_id" uuid not null,
    "inactive_threshold_days" integer not null default 45,
    "at_risk_threshold_days" integer not null default 21,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."store_analytics_settings" enable row level security;


  create table "public"."store_schedules" (
    "id" uuid not null default gen_random_uuid(),
    "store_id" uuid not null,
    "game_id" uuid not null,
    "day_of_week" smallint not null,
    "start_time" time without time zone,
    "notes" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."store_schedules" enable row level security;


  create table "public"."tournament_round_results" (
    "id" uuid not null default gen_random_uuid(),
    "tournament_id" uuid not null,
    "reporter_player_id" uuid not null,
    "player_id" uuid not null,
    "opponent_player_id" uuid,
    "round_number" integer not null,
    "is_bye" boolean not null default false,
    "player_leader_id" uuid,
    "opponent_leader_id" uuid,
    "won_die_roll" boolean,
    "turn_order" text,
    "won_match" boolean,
    "notes" text,
    "is_auto_populated" boolean not null default false,
    "status" text not null default 'confirmed'::text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "source_session_id" uuid
      );


alter table "public"."tournament_round_results" enable row level security;

alter table "public"."leaderboard_snapshots" alter column timeframe_type type "public"."timeframe_type" using timeframe_type::text::"public"."timeframe_type";

alter table "public"."tournaments" alter column status type "public"."tournament_status" using status::text::"public"."tournament_status";

alter table "public"."tournaments" alter column "status" set default 'DRAFT'::public.tournament_status;

drop type "public"."timeframe_type__old_version_to_be_dropped";

drop type "public"."tournament_status__old_version_to_be_dropped";

alter table "public"."games" alter column "name" set data type character varying using "name"::character varying;

alter table "public"."games" alter column "publisher" set data type character varying using "publisher"::character varying;

alter table "public"."games" alter column "slug" set data type character varying using "slug"::character varying;

alter table "public"."leaderboard_snapshots" add column "omw_percentage" numeric(5,2) default 0;

alter table "public"."leaderboard_snapshots" add column "season_id" uuid;

alter table "public"."leaderboard_snapshots" alter column "timeframe_value" set data type character varying using "timeframe_value"::character varying;

alter table "public"."leaderboard_snapshots" alter column "total_points" set data type numeric(10,2) using "total_points"::numeric(10,2);

alter table "public"."players" add column "auth_user_id" uuid;

alter table "public"."players" add column "birth_date" date;

alter table "public"."players" add column "contact_backup" text;

alter table "public"."players" add column "contact_primary" text;

alter table "public"."players" add column "gender" text;

alter table "public"."players" add column "is_profile_public" boolean not null default true;

alter table "public"."players" add column "role" text not null default 'player'::text;

alter table "public"."players" add column "work_schedule" text;

alter table "public"."players" alter column "display_name" set data type character varying using "display_name"::character varying;

alter table "public"."players" alter column "email" set data type character varying using "email"::character varying;

alter table "public"."players" alter column "geek_tag" set data type character varying using "geek_tag"::character varying;

alter table "public"."stores" add column "address" text;

alter table "public"."stores" add column "description" text;

alter table "public"."stores" add column "google_maps_url" text;

alter table "public"."stores" add column "instagram" character varying(100);

alter table "public"."stores" add column "latitude" numeric(10,7);

alter table "public"."stores" add column "longitude" numeric(10,7);

alter table "public"."stores" add column "opening_hours" text;

alter table "public"."stores" add column "phone" character varying(20);

alter table "public"."stores" add column "twitch" text;

alter table "public"."stores" add column "twitter" text;

alter table "public"."stores" add column "website" text;

alter table "public"."stores" add column "zone" text generated always as (
CASE
    WHEN (((city)::text ~~* '%monterrey%'::text) OR ((city)::text ~~* '%san pedro%'::text) OR ((city)::text ~~* '%guadalupe%'::text) OR ((city)::text ~~* '%san nicolas%'::text) OR ((city)::text ~~* '%apodaca%'::text)) THEN 'Zona Monterrey'::text
    WHEN (((city)::text ~~* '%guadalajara%'::text) OR ((city)::text ~~* '%zapopan%'::text) OR ((city)::text ~~* '%tlaquepaque%'::text) OR ((city)::text ~~* '%tonala%'::text)) THEN 'Zona Guadalajara'::text
    WHEN (((city)::text ~~* '%mexico%'::text) OR ((city)::text ~~* '%cdmx%'::text) OR ((city)::text ~~* '%ciudad de mexico%'::text) OR ((city)::text ~~* '%naucalpan%'::text) OR ((city)::text ~~* '%ecatepec%'::text)) THEN 'Zona Centro'::text
    ELSE 'Zona Extendida'::text
END) stored;

alter table "public"."stores" alter column "city" set data type character varying using "city"::character varying;

alter table "public"."stores" alter column "name" set data type character varying using "name"::character varying;

alter table "public"."stores" alter column "slug" set data type character varying using "slug"::character varying;

alter table "public"."stores" alter column "state" set data type character varying using "state"::character varying;

alter table "public"."tournament_results" add column "draws" smallint not null default 0;

alter table "public"."tournament_results" add column "match_points" smallint not null default 0;

alter table "public"."tournament_results" add column "omw_percentage" numeric(5,2) not null default 0;

alter table "public"."tournament_results" alter column "points_earned" set data type numeric(6,2) using "points_earned"::numeric(6,2);

alter table "public"."tournaments" add column "approved_by" uuid;

alter table "public"."tournaments" add column "rejection_reason" text;

alter table "public"."tournaments" add column "season_id" uuid;

alter table "public"."tournaments" add column "tournament_time" time without time zone;

alter table "public"."tournaments" add column "unpublish_reason" text;

alter table "public"."tournaments" add column "unpublished_at" timestamp with time zone;

alter table "public"."tournaments" add column "unpublished_by" uuid;

CREATE UNIQUE INDEX ad_metrics_pkey ON public.ad_metrics USING btree (id);

CREATE UNIQUE INDEX admin_audit_log_pkey ON public.admin_audit_log USING btree (id);

CREATE UNIQUE INDEX deck_identifiers_game_image_source_key ON public.deck_identifiers USING btree (game_id, card_image_id, api_source);

CREATE UNIQUE INDEX deck_identifiers_pkey ON public.deck_identifiers USING btree (id);

CREATE UNIQUE INDEX deck_identifiers_sync_log_pkey ON public.deck_identifiers_sync_log USING btree (id);

CREATE INDEX idx_deck_identifiers_base_name ON public.deck_identifiers USING btree (game_id, base_name);

CREATE INDEX idx_deck_identifiers_base_name_trgm ON public.deck_identifiers USING gin (base_name public.gin_trgm_ops);

CREATE INDEX idx_deck_identifiers_game_active ON public.deck_identifiers USING btree (game_id, is_active);

CREATE INDEX idx_lb_game_tf ON public.leaderboard_snapshots USING btree (game_id, timeframe_type, timeframe_value, rank_position);

CREATE INDEX idx_lb_player ON public.leaderboard_snapshots USING btree (player_id);

CREATE INDEX idx_manager_games_game ON public.manager_games USING btree (game_id);

CREATE INDEX idx_manager_games_player ON public.manager_games USING btree (player_id);

CREATE INDEX idx_player_games_game ON public.player_games USING btree (game_id);

CREATE INDEX idx_player_games_player ON public.player_games USING btree (player_id);

CREATE INDEX idx_player_tcg_ids_normalized ON public.player_tcg_ids USING btree (game_id, tcg_user_id_normalized);

CREATE INDEX idx_players_home_store ON public.players USING btree (home_store_id);

CREATE INDEX idx_results_player ON public.tournament_results USING btree (player_id);

CREATE INDEX idx_results_tournament ON public.tournament_results USING btree (tournament_id);

CREATE INDEX idx_round_appeals_store_status ON public.round_appeals USING btree (store_id, status);

CREATE INDEX idx_session_link_events_session ON public.session_link_events USING btree (session_id, created_at DESC);

CREATE INDEX idx_standalone_rounds_session ON public.standalone_round_results USING btree (session_id, player_id);

CREATE INDEX idx_standalone_sessions_player_status ON public.standalone_sessions USING btree (player_id, status, created_at DESC);

CREATE INDEX idx_standalone_sessions_unlinked ON public.standalone_sessions USING btree (player_id, game_id, session_date) WHERE ((session_type = 'competitive'::text) AND (status = 'unlinked'::text));

CREATE INDEX idx_tournaments_date ON public.tournaments USING btree (tournament_date);

CREATE INDEX idx_tournaments_game ON public.tournaments USING btree (game_id);

CREATE INDEX idx_tournaments_store ON public.tournaments USING btree (store_id);

CREATE INDEX idx_trr_source_session ON public.tournament_round_results USING btree (source_session_id) WHERE (source_session_id IS NOT NULL);

CREATE INDEX idx_trr_tournament_player ON public.tournament_round_results USING btree (tournament_id, player_id);

CREATE UNIQUE INDEX manager_games_pkey ON public.manager_games USING btree (id);

CREATE UNIQUE INDEX player_games_pkey ON public.player_games USING btree (id);

CREATE UNIQUE INDEX player_tcg_ids_pkey ON public.player_tcg_ids USING btree (id);

CREATE UNIQUE INDEX players_email_unique ON public.players USING btree (email);

CREATE UNIQUE INDEX round_appeals_one_pending_per_round ON public.round_appeals USING btree (original_round_id) WHERE (status = 'pending'::text);

CREATE UNIQUE INDEX round_appeals_pkey ON public.round_appeals USING btree (id);

CREATE UNIQUE INDEX seasons_pkey ON public.seasons USING btree (id);

CREATE UNIQUE INDEX seasons_slug_key ON public.seasons USING btree (slug);

CREATE UNIQUE INDEX session_link_events_pkey ON public.session_link_events USING btree (id);

CREATE UNIQUE INDEX sponsor_view_metrics_pkey ON public.sponsor_view_metrics USING btree (id);

CREATE UNIQUE INDEX sponsor_view_metrics_sponsor_id_month_year_key ON public.sponsor_view_metrics USING btree (sponsor_id, month_year);

CREATE UNIQUE INDEX sponsors_pkey ON public.sponsors USING btree (id);

CREATE UNIQUE INDEX sponsors_priority_rank_key ON public.sponsors USING btree (priority_rank);

CREATE UNIQUE INDEX standalone_round_results_pkey ON public.standalone_round_results USING btree (id);

CREATE UNIQUE INDEX standalone_round_results_session_id_player_id_round_number_key ON public.standalone_round_results USING btree (session_id, player_id, round_number);

CREATE UNIQUE INDEX standalone_sessions_pkey ON public.standalone_sessions USING btree (id);

CREATE UNIQUE INDEX store_analytics_settings_pkey ON public.store_analytics_settings USING btree (id);

CREATE UNIQUE INDEX store_analytics_settings_store_id_key ON public.store_analytics_settings USING btree (store_id);

CREATE UNIQUE INDEX store_schedules_pkey ON public.store_schedules USING btree (id);

CREATE UNIQUE INDEX tournament_round_results_pkey ON public.tournament_round_results USING btree (id);

CREATE UNIQUE INDEX tournament_round_results_tournament_id_player_id_round_numb_key ON public.tournament_round_results USING btree (tournament_id, player_id, round_number);

CREATE UNIQUE INDEX uq_manager_game ON public.manager_games USING btree (player_id, game_id);

CREATE UNIQUE INDEX uq_player_game ON public.player_games USING btree (player_id, game_id);

CREATE UNIQUE INDEX uq_player_game_id ON public.player_tcg_ids USING btree (player_id, game_id);

CREATE UNIQUE INDEX uq_store_schedule ON public.store_schedules USING btree (store_id, game_id, day_of_week);

alter table "public"."ad_metrics" add constraint "ad_metrics_pkey" PRIMARY KEY using index "ad_metrics_pkey";

alter table "public"."admin_audit_log" add constraint "admin_audit_log_pkey" PRIMARY KEY using index "admin_audit_log_pkey";

alter table "public"."deck_identifiers" add constraint "deck_identifiers_pkey" PRIMARY KEY using index "deck_identifiers_pkey";

alter table "public"."deck_identifiers_sync_log" add constraint "deck_identifiers_sync_log_pkey" PRIMARY KEY using index "deck_identifiers_sync_log_pkey";

alter table "public"."manager_games" add constraint "manager_games_pkey" PRIMARY KEY using index "manager_games_pkey";

alter table "public"."player_games" add constraint "player_games_pkey" PRIMARY KEY using index "player_games_pkey";

alter table "public"."player_tcg_ids" add constraint "player_tcg_ids_pkey" PRIMARY KEY using index "player_tcg_ids_pkey";

alter table "public"."round_appeals" add constraint "round_appeals_pkey" PRIMARY KEY using index "round_appeals_pkey";

alter table "public"."seasons" add constraint "seasons_pkey" PRIMARY KEY using index "seasons_pkey";

alter table "public"."session_link_events" add constraint "session_link_events_pkey" PRIMARY KEY using index "session_link_events_pkey";

alter table "public"."sponsor_view_metrics" add constraint "sponsor_view_metrics_pkey" PRIMARY KEY using index "sponsor_view_metrics_pkey";

alter table "public"."sponsors" add constraint "sponsors_pkey" PRIMARY KEY using index "sponsors_pkey";

alter table "public"."standalone_round_results" add constraint "standalone_round_results_pkey" PRIMARY KEY using index "standalone_round_results_pkey";

alter table "public"."standalone_sessions" add constraint "standalone_sessions_pkey" PRIMARY KEY using index "standalone_sessions_pkey";

alter table "public"."store_analytics_settings" add constraint "store_analytics_settings_pkey" PRIMARY KEY using index "store_analytics_settings_pkey";

alter table "public"."store_schedules" add constraint "store_schedules_pkey" PRIMARY KEY using index "store_schedules_pkey";

alter table "public"."tournament_round_results" add constraint "tournament_round_results_pkey" PRIMARY KEY using index "tournament_round_results_pkey";

alter table "public"."ad_metrics" add constraint "ad_metrics_current_sponsor_id_fkey" FOREIGN KEY (current_sponsor_id) REFERENCES public.sponsors(id) not valid;

alter table "public"."ad_metrics" validate constraint "ad_metrics_current_sponsor_id_fkey";

alter table "public"."admin_audit_log" add constraint "admin_audit_log_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES public.players(id) ON DELETE CASCADE not valid;

alter table "public"."admin_audit_log" validate constraint "admin_audit_log_actor_id_fkey";

alter table "public"."deck_identifiers" add constraint "deck_identifiers_api_source_check" CHECK ((api_source = ANY (ARRAY['set'::text, 'deck'::text, 'promo'::text]))) not valid;

alter table "public"."deck_identifiers" validate constraint "deck_identifiers_api_source_check";

alter table "public"."deck_identifiers" add constraint "deck_identifiers_canonical_leader_id_fkey" FOREIGN KEY (canonical_leader_id) REFERENCES public.deck_identifiers(id) not valid;

alter table "public"."deck_identifiers" validate constraint "deck_identifiers_canonical_leader_id_fkey";

alter table "public"."deck_identifiers" add constraint "deck_identifiers_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.players(id) not valid;

alter table "public"."deck_identifiers" validate constraint "deck_identifiers_created_by_fkey";

alter table "public"."deck_identifiers" add constraint "deck_identifiers_game_id_fkey" FOREIGN KEY (game_id) REFERENCES public.games(id) not valid;

alter table "public"."deck_identifiers" validate constraint "deck_identifiers_game_id_fkey";

alter table "public"."deck_identifiers" add constraint "deck_identifiers_game_image_source_key" UNIQUE using index "deck_identifiers_game_image_source_key";

alter table "public"."deck_identifiers" add constraint "deck_identifiers_identifier_type_check" CHECK ((identifier_type = ANY (ARRAY['leader'::text, 'commander'::text, 'champion'::text, 'archetype'::text]))) not valid;

alter table "public"."deck_identifiers" validate constraint "deck_identifiers_identifier_type_check";

alter table "public"."deck_identifiers" add constraint "deck_identifiers_source_check" CHECK ((source = ANY (ARRAY['api'::text, 'manual'::text]))) not valid;

alter table "public"."deck_identifiers" validate constraint "deck_identifiers_source_check";

alter table "public"."deck_identifiers_sync_log" add constraint "deck_identifiers_sync_log_game_id_fkey" FOREIGN KEY (game_id) REFERENCES public.games(id) not valid;

alter table "public"."deck_identifiers_sync_log" validate constraint "deck_identifiers_sync_log_game_id_fkey";

alter table "public"."deck_identifiers_sync_log" add constraint "deck_identifiers_sync_log_status_check" CHECK ((status = ANY (ARRAY['success'::text, 'error'::text]))) not valid;

alter table "public"."deck_identifiers_sync_log" validate constraint "deck_identifiers_sync_log_status_check";

alter table "public"."leaderboard_snapshots" add constraint "leaderboard_snapshots_season_id_fkey" FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE CASCADE not valid;

alter table "public"."leaderboard_snapshots" validate constraint "leaderboard_snapshots_season_id_fkey";

alter table "public"."manager_games" add constraint "manager_games_game_id_fkey" FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE not valid;

alter table "public"."manager_games" validate constraint "manager_games_game_id_fkey";

alter table "public"."manager_games" add constraint "manager_games_player_id_fkey" FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE not valid;

alter table "public"."manager_games" validate constraint "manager_games_player_id_fkey";

alter table "public"."manager_games" add constraint "uq_manager_game" UNIQUE using index "uq_manager_game";

alter table "public"."player_games" add constraint "player_games_game_id_fkey" FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE not valid;

alter table "public"."player_games" validate constraint "player_games_game_id_fkey";

alter table "public"."player_games" add constraint "player_games_player_id_fkey" FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE not valid;

alter table "public"."player_games" validate constraint "player_games_player_id_fkey";

alter table "public"."player_games" add constraint "uq_player_game" UNIQUE using index "uq_player_game";

alter table "public"."player_tcg_ids" add constraint "player_tcg_ids_game_id_fkey" FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE not valid;

alter table "public"."player_tcg_ids" validate constraint "player_tcg_ids_game_id_fkey";

alter table "public"."player_tcg_ids" add constraint "player_tcg_ids_player_id_fkey" FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE not valid;

alter table "public"."player_tcg_ids" validate constraint "player_tcg_ids_player_id_fkey";

alter table "public"."player_tcg_ids" add constraint "uq_player_game_id" UNIQUE using index "uq_player_game_id";

alter table "public"."players" add constraint "players_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."players" validate constraint "players_auth_user_id_fkey";

alter table "public"."players" add constraint "players_gender_check" CHECK ((gender = ANY (ARRAY['hombre'::text, 'mujer'::text, 'no_especificado'::text]))) not valid;

alter table "public"."players" validate constraint "players_gender_check";

alter table "public"."players" add constraint "players_role_check" CHECK ((role = ANY (ARRAY['player'::text, 'organizer'::text, 'tcg_manager'::text, 'admin'::text]))) not valid;

alter table "public"."players" validate constraint "players_role_check";

alter table "public"."round_appeals" add constraint "round_appeals_appellant_player_id_fkey" FOREIGN KEY (appellant_player_id) REFERENCES public.players(id) not valid;

alter table "public"."round_appeals" validate constraint "round_appeals_appellant_player_id_fkey";

alter table "public"."round_appeals" add constraint "round_appeals_original_opponent_leader_id_fkey" FOREIGN KEY (original_opponent_leader_id) REFERENCES public.deck_identifiers(id) not valid;

alter table "public"."round_appeals" validate constraint "round_appeals_original_opponent_leader_id_fkey";

alter table "public"."round_appeals" add constraint "round_appeals_original_player_leader_id_fkey" FOREIGN KEY (original_player_leader_id) REFERENCES public.deck_identifiers(id) not valid;

alter table "public"."round_appeals" validate constraint "round_appeals_original_player_leader_id_fkey";

alter table "public"."round_appeals" add constraint "round_appeals_original_round_id_fkey" FOREIGN KEY (original_round_id) REFERENCES public.tournament_round_results(id) not valid;

alter table "public"."round_appeals" validate constraint "round_appeals_original_round_id_fkey";

alter table "public"."round_appeals" add constraint "round_appeals_original_turn_order_check" CHECK ((original_turn_order = ANY (ARRAY['first'::text, 'second'::text]))) not valid;

alter table "public"."round_appeals" validate constraint "round_appeals_original_turn_order_check";

alter table "public"."round_appeals" add constraint "round_appeals_proposed_opponent_leader_id_fkey" FOREIGN KEY (proposed_opponent_leader_id) REFERENCES public.deck_identifiers(id) not valid;

alter table "public"."round_appeals" validate constraint "round_appeals_proposed_opponent_leader_id_fkey";

alter table "public"."round_appeals" add constraint "round_appeals_proposed_player_leader_id_fkey" FOREIGN KEY (proposed_player_leader_id) REFERENCES public.deck_identifiers(id) not valid;

alter table "public"."round_appeals" validate constraint "round_appeals_proposed_player_leader_id_fkey";

alter table "public"."round_appeals" add constraint "round_appeals_proposed_turn_order_check" CHECK ((proposed_turn_order = ANY (ARRAY['first'::text, 'second'::text]))) not valid;

alter table "public"."round_appeals" validate constraint "round_appeals_proposed_turn_order_check";

alter table "public"."round_appeals" add constraint "round_appeals_resolution_check" CHECK ((resolution = ANY (ARRAY['accepted_original'::text, 'accepted_proposed'::text]))) not valid;

alter table "public"."round_appeals" validate constraint "round_appeals_resolution_check";

alter table "public"."round_appeals" add constraint "round_appeals_resolved_by_fkey" FOREIGN KEY (resolved_by) REFERENCES public.players(id) not valid;

alter table "public"."round_appeals" validate constraint "round_appeals_resolved_by_fkey";

alter table "public"."round_appeals" add constraint "round_appeals_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'resolved'::text]))) not valid;

alter table "public"."round_appeals" validate constraint "round_appeals_status_check";

alter table "public"."round_appeals" add constraint "round_appeals_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) not valid;

alter table "public"."round_appeals" validate constraint "round_appeals_store_id_fkey";

alter table "public"."round_appeals" add constraint "round_appeals_tournament_id_fkey" FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) not valid;

alter table "public"."round_appeals" validate constraint "round_appeals_tournament_id_fkey";

alter table "public"."seasons" add constraint "seasons_slug_key" UNIQUE using index "seasons_slug_key";

alter table "public"."seasons" add constraint "seasons_status_check" CHECK ((status = ANY (ARRAY['UPCOMING'::text, 'ACTIVE'::text, 'CLOSED'::text]))) not valid;

alter table "public"."seasons" validate constraint "seasons_status_check";

alter table "public"."session_link_events" add constraint "session_link_events_actor_player_id_fkey" FOREIGN KEY (actor_player_id) REFERENCES public.players(id) not valid;

alter table "public"."session_link_events" validate constraint "session_link_events_actor_player_id_fkey";

alter table "public"."session_link_events" add constraint "session_link_events_event_type_check" CHECK ((event_type = ANY (ARRAY['linked'::text, 'unlinked'::text, 'conflict'::text]))) not valid;

alter table "public"."session_link_events" validate constraint "session_link_events_event_type_check";

alter table "public"."session_link_events" add constraint "session_link_events_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.standalone_sessions(id) not valid;

alter table "public"."session_link_events" validate constraint "session_link_events_session_id_fkey";

alter table "public"."session_link_events" add constraint "session_link_events_tournament_id_fkey" FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) not valid;

alter table "public"."session_link_events" validate constraint "session_link_events_tournament_id_fkey";

alter table "public"."sponsor_view_metrics" add constraint "sponsor_view_metrics_sponsor_id_fkey" FOREIGN KEY (sponsor_id) REFERENCES public.sponsors(id) ON DELETE CASCADE not valid;

alter table "public"."sponsor_view_metrics" validate constraint "sponsor_view_metrics_sponsor_id_fkey";

alter table "public"."sponsor_view_metrics" add constraint "sponsor_view_metrics_sponsor_id_month_year_key" UNIQUE using index "sponsor_view_metrics_sponsor_id_month_year_key";

alter table "public"."sponsors" add constraint "sponsors_priority_rank_key" UNIQUE using index "sponsors_priority_rank_key";

alter table "public"."standalone_round_results" add constraint "standalone_round_results_opponent_leader_id_fkey" FOREIGN KEY (opponent_leader_id) REFERENCES public.deck_identifiers(id) not valid;

alter table "public"."standalone_round_results" validate constraint "standalone_round_results_opponent_leader_id_fkey";

alter table "public"."standalone_round_results" add constraint "standalone_round_results_opponent_player_id_fkey" FOREIGN KEY (opponent_player_id) REFERENCES public.players(id) not valid;

alter table "public"."standalone_round_results" validate constraint "standalone_round_results_opponent_player_id_fkey";

alter table "public"."standalone_round_results" add constraint "standalone_round_results_player_id_fkey" FOREIGN KEY (player_id) REFERENCES public.players(id) not valid;

alter table "public"."standalone_round_results" validate constraint "standalone_round_results_player_id_fkey";

alter table "public"."standalone_round_results" add constraint "standalone_round_results_player_leader_id_fkey" FOREIGN KEY (player_leader_id) REFERENCES public.deck_identifiers(id) not valid;

alter table "public"."standalone_round_results" validate constraint "standalone_round_results_player_leader_id_fkey";

alter table "public"."standalone_round_results" add constraint "standalone_round_results_reporter_player_id_fkey" FOREIGN KEY (reporter_player_id) REFERENCES public.players(id) not valid;

alter table "public"."standalone_round_results" validate constraint "standalone_round_results_reporter_player_id_fkey";

alter table "public"."standalone_round_results" add constraint "standalone_round_results_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.standalone_sessions(id) ON DELETE CASCADE not valid;

alter table "public"."standalone_round_results" validate constraint "standalone_round_results_session_id_fkey";

alter table "public"."standalone_round_results" add constraint "standalone_round_results_session_id_player_id_round_number_key" UNIQUE using index "standalone_round_results_session_id_player_id_round_number_key";

alter table "public"."standalone_round_results" add constraint "standalone_round_results_status_check" CHECK ((status = ANY (ARRAY['confirmed'::text, 'pending_confirmation'::text, 'under_appeal'::text]))) not valid;

alter table "public"."standalone_round_results" validate constraint "standalone_round_results_status_check";

alter table "public"."standalone_round_results" add constraint "standalone_round_results_turn_order_check" CHECK ((turn_order = ANY (ARRAY['first'::text, 'second'::text]))) not valid;

alter table "public"."standalone_round_results" validate constraint "standalone_round_results_turn_order_check";

alter table "public"."standalone_sessions" add constraint "casual_sessions_no_store_or_time" CHECK (((session_type <> 'casual'::text) OR ((store_id IS NULL) AND (session_time IS NULL)))) not valid;

alter table "public"."standalone_sessions" validate constraint "casual_sessions_no_store_or_time";

alter table "public"."standalone_sessions" add constraint "competitive_sessions_require_fields" CHECK (((session_type <> 'competitive'::text) OR ((session_date IS NOT NULL) AND (session_time IS NOT NULL) AND (store_id IS NOT NULL)))) not valid;

alter table "public"."standalone_sessions" validate constraint "competitive_sessions_require_fields";

alter table "public"."standalone_sessions" add constraint "matched_sessions_must_have_tournament" CHECK (((status <> 'matched'::text) OR (tournament_id IS NOT NULL))) not valid;

alter table "public"."standalone_sessions" validate constraint "matched_sessions_must_have_tournament";

alter table "public"."standalone_sessions" add constraint "standalone_sessions_game_id_fkey" FOREIGN KEY (game_id) REFERENCES public.games(id) not valid;

alter table "public"."standalone_sessions" validate constraint "standalone_sessions_game_id_fkey";

alter table "public"."standalone_sessions" add constraint "standalone_sessions_player_id_fkey" FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE not valid;

alter table "public"."standalone_sessions" validate constraint "standalone_sessions_player_id_fkey";

alter table "public"."standalone_sessions" add constraint "standalone_sessions_player_leader_id_fkey" FOREIGN KEY (player_leader_id) REFERENCES public.deck_identifiers(id) not valid;

alter table "public"."standalone_sessions" validate constraint "standalone_sessions_player_leader_id_fkey";

alter table "public"."standalone_sessions" add constraint "standalone_sessions_session_type_check" CHECK ((session_type = ANY (ARRAY['competitive'::text, 'casual'::text]))) not valid;

alter table "public"."standalone_sessions" validate constraint "standalone_sessions_session_type_check";

alter table "public"."standalone_sessions" add constraint "standalone_sessions_status_check" CHECK ((status = ANY (ARRAY['unlinked'::text, 'matched'::text, 'casual'::text]))) not valid;

alter table "public"."standalone_sessions" validate constraint "standalone_sessions_status_check";

alter table "public"."standalone_sessions" add constraint "standalone_sessions_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) not valid;

alter table "public"."standalone_sessions" validate constraint "standalone_sessions_store_id_fkey";

alter table "public"."standalone_sessions" add constraint "standalone_sessions_tournament_id_fkey" FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) not valid;

alter table "public"."standalone_sessions" validate constraint "standalone_sessions_tournament_id_fkey";

alter table "public"."store_analytics_settings" add constraint "store_analytics_settings_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) not valid;

alter table "public"."store_analytics_settings" validate constraint "store_analytics_settings_store_id_fkey";

alter table "public"."store_analytics_settings" add constraint "store_analytics_settings_store_id_key" UNIQUE using index "store_analytics_settings_store_id_key";

alter table "public"."store_schedules" add constraint "store_schedules_day_of_week_check" CHECK (((day_of_week >= 0) AND (day_of_week <= 6))) not valid;

alter table "public"."store_schedules" validate constraint "store_schedules_day_of_week_check";

alter table "public"."store_schedules" add constraint "store_schedules_game_id_fkey" FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE not valid;

alter table "public"."store_schedules" validate constraint "store_schedules_game_id_fkey";

alter table "public"."store_schedules" add constraint "store_schedules_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."store_schedules" validate constraint "store_schedules_store_id_fkey";

alter table "public"."store_schedules" add constraint "uq_store_schedule" UNIQUE using index "uq_store_schedule";

alter table "public"."tournament_round_results" add constraint "tournament_round_results_opponent_leader_id_fkey" FOREIGN KEY (opponent_leader_id) REFERENCES public.deck_identifiers(id) not valid;

alter table "public"."tournament_round_results" validate constraint "tournament_round_results_opponent_leader_id_fkey";

alter table "public"."tournament_round_results" add constraint "tournament_round_results_opponent_player_id_fkey" FOREIGN KEY (opponent_player_id) REFERENCES public.players(id) not valid;

alter table "public"."tournament_round_results" validate constraint "tournament_round_results_opponent_player_id_fkey";

alter table "public"."tournament_round_results" add constraint "tournament_round_results_player_id_fkey" FOREIGN KEY (player_id) REFERENCES public.players(id) not valid;

alter table "public"."tournament_round_results" validate constraint "tournament_round_results_player_id_fkey";

alter table "public"."tournament_round_results" add constraint "tournament_round_results_player_leader_id_fkey" FOREIGN KEY (player_leader_id) REFERENCES public.deck_identifiers(id) not valid;

alter table "public"."tournament_round_results" validate constraint "tournament_round_results_player_leader_id_fkey";

alter table "public"."tournament_round_results" add constraint "tournament_round_results_reporter_player_id_fkey" FOREIGN KEY (reporter_player_id) REFERENCES public.players(id) not valid;

alter table "public"."tournament_round_results" validate constraint "tournament_round_results_reporter_player_id_fkey";

alter table "public"."tournament_round_results" add constraint "tournament_round_results_source_session_id_fkey" FOREIGN KEY (source_session_id) REFERENCES public.standalone_sessions(id) not valid;

alter table "public"."tournament_round_results" validate constraint "tournament_round_results_source_session_id_fkey";

alter table "public"."tournament_round_results" add constraint "tournament_round_results_status_check" CHECK ((status = ANY (ARRAY['confirmed'::text, 'pending_confirmation'::text, 'under_appeal'::text]))) not valid;

alter table "public"."tournament_round_results" validate constraint "tournament_round_results_status_check";

alter table "public"."tournament_round_results" add constraint "tournament_round_results_tournament_id_fkey" FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) not valid;

alter table "public"."tournament_round_results" validate constraint "tournament_round_results_tournament_id_fkey";

alter table "public"."tournament_round_results" add constraint "tournament_round_results_tournament_id_player_id_round_numb_key" UNIQUE using index "tournament_round_results_tournament_id_player_id_round_numb_key";

alter table "public"."tournament_round_results" add constraint "tournament_round_results_turn_order_check" CHECK ((turn_order = ANY (ARRAY['first'::text, 'second'::text]))) not valid;

alter table "public"."tournament_round_results" validate constraint "tournament_round_results_turn_order_check";

alter table "public"."tournaments" add constraint "tournaments_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES public.players(id) ON DELETE SET NULL not valid;

alter table "public"."tournaments" validate constraint "tournaments_approved_by_fkey";

alter table "public"."tournaments" add constraint "tournaments_season_id_fkey" FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE SET NULL not valid;

alter table "public"."tournaments" validate constraint "tournaments_season_id_fkey";

alter table "public"."tournaments" add constraint "tournaments_unpublished_by_fkey" FOREIGN KEY (unpublished_by) REFERENCES public.players(id) not valid;

alter table "public"."tournaments" validate constraint "tournaments_unpublished_by_fkey";

alter table "public"."leaderboard_snapshots" add constraint "leaderboard_snapshots_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE SET NULL not valid;

alter table "public"."leaderboard_snapshots" validate constraint "leaderboard_snapshots_store_id_fkey";

alter table "public"."tournament_results" add constraint "tournament_results_player_id_fkey" FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE RESTRICT not valid;

alter table "public"."tournament_results" validate constraint "tournament_results_player_id_fkey";

alter table "public"."tournaments" add constraint "tournaments_game_id_fkey" FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE RESTRICT not valid;

alter table "public"."tournaments" validate constraint "tournaments_game_id_fkey";

alter table "public"."tournaments" add constraint "tournaments_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE RESTRICT not valid;

alter table "public"."tournaments" validate constraint "tournaments_store_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.fn_match_standalone_sessions_on_publish()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_session        RECORD;
  v_candidate_count INT;
  v_tournament_time TIME;
BEGIN
  IF NEW.status != 'PUBLISHED' OR OLD.status = 'PUBLISHED' THEN
    RETURN NEW;
  END IF;

  -- Usar la hora del torneo si existe, sino mediodía como fallback
  v_tournament_time := COALESCE(NEW.tournament_time, '12:00:00'::TIME);

  FOR v_session IN
    SELECT ss.*
    FROM standalone_sessions ss
    WHERE ss.session_type = 'competitive'
      AND ss.status = 'unlinked'
      AND ss.game_id = NEW.game_id
      AND ss.store_id = NEW.store_id
      AND ss.session_date = NEW.tournament_date
      AND ABS(
        EXTRACT(EPOCH FROM (ss.session_time - v_tournament_time)) / 3600
      ) <= 3
      AND EXISTS (
        SELECT 1 FROM tournament_results tr
        WHERE tr.tournament_id = NEW.id
          AND tr.player_id = ss.player_id
      )
  LOOP
    SELECT COUNT(*) INTO v_candidate_count
    FROM tournaments t
    WHERE t.status = 'PUBLISHED'
      AND t.game_id = v_session.game_id
      AND t.store_id = v_session.store_id
      AND t.tournament_date = v_session.session_date
      AND EXISTS (
        SELECT 1 FROM tournament_results tr2
        WHERE tr2.tournament_id = t.id
          AND tr2.player_id = v_session.player_id
      );

    IF v_candidate_count = 1 THEN
      INSERT INTO tournament_round_results (
        tournament_id, player_id, opponent_player_id, round_number, is_bye,
        player_leader_id, opponent_leader_id, won_die_roll, turn_order, won_match,
        notes, is_auto_populated, status, reporter_player_id, source_session_id,
        created_at, updated_at
      )
      SELECT
        NEW.id, srr.player_id, srr.opponent_player_id, srr.round_number, srr.is_bye,
        srr.player_leader_id, srr.opponent_leader_id, srr.won_die_roll, srr.turn_order,
        srr.won_match, srr.notes, false, 'confirmed', srr.reporter_player_id,
        v_session.id, NOW(), NOW()
      FROM standalone_round_results srr
      WHERE srr.session_id = v_session.id
        AND NOT EXISTS (
          SELECT 1 FROM tournament_round_results trr_check
          WHERE trr_check.tournament_id = NEW.id
            AND trr_check.player_id = srr.player_id
            AND trr_check.round_number = srr.round_number
            AND trr_check.is_auto_populated = false
        );

      UPDATE standalone_sessions
      SET status = 'matched', tournament_id = NEW.id, updated_at = NOW()
      WHERE id = v_session.id;

      INSERT INTO session_link_events (
        session_id, event_type, tournament_id, actor_player_id, created_at
      ) VALUES (
        v_session.id, 'linked', NEW.id, v_session.player_id, NOW()
      );

    ELSE
      INSERT INTO session_link_events (
        session_id, event_type, tournament_id, actor_player_id, created_at
      ) VALUES (
        v_session.id, 'conflict', NEW.id, v_session.player_id, NOW()
      );
    END IF;

  END LOOP;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_player_id UUID;
  v_geek_tag  TEXT;
  v_game_ids  UUID[];
BEGIN
  v_geek_tag := NEW.raw_user_meta_data ->> 'geek_tag';

  -- Reclamar player auto-creado si existe (sin auth_user_id)
  SELECT id INTO v_player_id
  FROM public.players
  WHERE geek_tag = v_geek_tag
    AND auth_user_id IS NULL;

  IF FOUND THEN
    UPDATE public.players
    SET auth_user_id = NEW.id,
        email = NEW.email,
        is_active = false
    WHERE id = v_player_id;
  ELSE
    INSERT INTO public.players (geek_tag, email, auth_user_id, is_active)
    VALUES (v_geek_tag, NEW.email, NEW.id, false)
    RETURNING id INTO v_player_id;
  END IF;

  -- Insertar juegos seleccionados
  IF NEW.raw_user_meta_data ? 'game_ids' THEN
    SELECT ARRAY(
      SELECT (jsonb_array_elements_text(NEW.raw_user_meta_data -> 'game_ids'))::UUID
    ) INTO v_game_ids;

    INSERT INTO public.player_games (player_id, game_id)
    SELECT v_player_id, g
    FROM unnest(v_game_ids) AS g
    ON CONFLICT (player_id, game_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_sponsor_view(p_sponsor_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_current_views INTEGER;
  v_limit INTEGER;
BEGIN
  -- Obtener límite del sponsor
  SELECT view_limit INTO v_limit
  FROM sponsors WHERE id = p_sponsor_id;

  -- Upsert de vistas
  INSERT INTO sponsor_view_metrics (sponsor_id, month_year, views_count, cycles_count)
  VALUES (p_sponsor_id, TO_CHAR(NOW(), 'YYYY-MM'), 1, 0)
  ON CONFLICT (sponsor_id, month_year)
  DO UPDATE SET
    views_count = sponsor_view_metrics.views_count + 1,
    updated_at = NOW()
  RETURNING views_count INTO v_current_views;

  -- Si llegó al límite, incrementar ciclo y resetear vistas
  IF v_current_views >= v_limit THEN
    UPDATE sponsor_view_metrics
    SET
      views_count = 0,
      cycles_count = cycles_count + 1,
      updated_at = NOW()
    WHERE sponsor_id = p_sponsor_id
      AND month_year = TO_CHAR(NOW(), 'YYYY-MM');
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_tcg_id()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Remove leading zeros for numeric IDs
  NEW.tcg_user_id_normalized = LTRIM(NEW.tcg_user_id, '0');
  -- If result is empty (was all zeros), keep '0'
  IF NEW.tcg_user_id_normalized = '' THEN
    NEW.tcg_user_id_normalized = '0';
  END IF;
  RETURN NEW;
END;
$function$
;

create or replace view "public"."players_public" as  SELECT id,
    geek_tag,
    display_name,
    avatar_url,
    home_store_id,
    is_active,
    role,
    created_at
   FROM public.players;


create or replace view "public"."public_players_view" as  SELECT id,
    geek_tag,
    display_name,
    avatar_url,
    role,
    is_active,
    created_at
   FROM public.players
  WHERE (is_profile_public = true);


create or replace view "public"."sponsor_metrics_current_month" as  SELECT s.id,
    s.name,
    s.is_active,
    s.view_limit,
    s.display_order,
    COALESCE(svm.views_count, 0) AS views_this_month,
    COALESCE(svm.cycles_count, 0) AS cycles_count,
        CASE
            WHEN (s.view_limit > 0) THEN round((((COALESCE(svm.views_count, 0))::numeric / (s.view_limit)::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS pct_consumed
   FROM (public.sponsors s
     LEFT JOIN public.sponsor_view_metrics svm ON (((svm.sponsor_id = s.id) AND (svm.month_year = to_char(now(), 'YYYY-MM'::text)))))
  WHERE (s.is_active = true)
  ORDER BY s.display_order;


grant delete on table "public"."ad_metrics" to "anon";

grant insert on table "public"."ad_metrics" to "anon";

grant references on table "public"."ad_metrics" to "anon";

grant select on table "public"."ad_metrics" to "anon";

grant trigger on table "public"."ad_metrics" to "anon";

grant truncate on table "public"."ad_metrics" to "anon";

grant update on table "public"."ad_metrics" to "anon";

grant delete on table "public"."ad_metrics" to "authenticated";

grant insert on table "public"."ad_metrics" to "authenticated";

grant references on table "public"."ad_metrics" to "authenticated";

grant select on table "public"."ad_metrics" to "authenticated";

grant trigger on table "public"."ad_metrics" to "authenticated";

grant truncate on table "public"."ad_metrics" to "authenticated";

grant update on table "public"."ad_metrics" to "authenticated";

grant delete on table "public"."ad_metrics" to "service_role";

grant insert on table "public"."ad_metrics" to "service_role";

grant references on table "public"."ad_metrics" to "service_role";

grant select on table "public"."ad_metrics" to "service_role";

grant trigger on table "public"."ad_metrics" to "service_role";

grant truncate on table "public"."ad_metrics" to "service_role";

grant update on table "public"."ad_metrics" to "service_role";

grant delete on table "public"."admin_audit_log" to "anon";

grant insert on table "public"."admin_audit_log" to "anon";

grant references on table "public"."admin_audit_log" to "anon";

grant select on table "public"."admin_audit_log" to "anon";

grant trigger on table "public"."admin_audit_log" to "anon";

grant truncate on table "public"."admin_audit_log" to "anon";

grant update on table "public"."admin_audit_log" to "anon";

grant delete on table "public"."admin_audit_log" to "authenticated";

grant insert on table "public"."admin_audit_log" to "authenticated";

grant references on table "public"."admin_audit_log" to "authenticated";

grant select on table "public"."admin_audit_log" to "authenticated";

grant trigger on table "public"."admin_audit_log" to "authenticated";

grant truncate on table "public"."admin_audit_log" to "authenticated";

grant update on table "public"."admin_audit_log" to "authenticated";

grant delete on table "public"."admin_audit_log" to "service_role";

grant insert on table "public"."admin_audit_log" to "service_role";

grant references on table "public"."admin_audit_log" to "service_role";

grant select on table "public"."admin_audit_log" to "service_role";

grant trigger on table "public"."admin_audit_log" to "service_role";

grant truncate on table "public"."admin_audit_log" to "service_role";

grant update on table "public"."admin_audit_log" to "service_role";

grant delete on table "public"."deck_identifiers" to "anon";

grant insert on table "public"."deck_identifiers" to "anon";

grant references on table "public"."deck_identifiers" to "anon";

grant select on table "public"."deck_identifiers" to "anon";

grant trigger on table "public"."deck_identifiers" to "anon";

grant truncate on table "public"."deck_identifiers" to "anon";

grant update on table "public"."deck_identifiers" to "anon";

grant delete on table "public"."deck_identifiers" to "authenticated";

grant insert on table "public"."deck_identifiers" to "authenticated";

grant references on table "public"."deck_identifiers" to "authenticated";

grant select on table "public"."deck_identifiers" to "authenticated";

grant trigger on table "public"."deck_identifiers" to "authenticated";

grant truncate on table "public"."deck_identifiers" to "authenticated";

grant update on table "public"."deck_identifiers" to "authenticated";

grant delete on table "public"."deck_identifiers" to "service_role";

grant insert on table "public"."deck_identifiers" to "service_role";

grant references on table "public"."deck_identifiers" to "service_role";

grant select on table "public"."deck_identifiers" to "service_role";

grant trigger on table "public"."deck_identifiers" to "service_role";

grant truncate on table "public"."deck_identifiers" to "service_role";

grant update on table "public"."deck_identifiers" to "service_role";

grant delete on table "public"."deck_identifiers_sync_log" to "anon";

grant insert on table "public"."deck_identifiers_sync_log" to "anon";

grant references on table "public"."deck_identifiers_sync_log" to "anon";

grant select on table "public"."deck_identifiers_sync_log" to "anon";

grant trigger on table "public"."deck_identifiers_sync_log" to "anon";

grant truncate on table "public"."deck_identifiers_sync_log" to "anon";

grant update on table "public"."deck_identifiers_sync_log" to "anon";

grant delete on table "public"."deck_identifiers_sync_log" to "authenticated";

grant insert on table "public"."deck_identifiers_sync_log" to "authenticated";

grant references on table "public"."deck_identifiers_sync_log" to "authenticated";

grant select on table "public"."deck_identifiers_sync_log" to "authenticated";

grant trigger on table "public"."deck_identifiers_sync_log" to "authenticated";

grant truncate on table "public"."deck_identifiers_sync_log" to "authenticated";

grant update on table "public"."deck_identifiers_sync_log" to "authenticated";

grant delete on table "public"."deck_identifiers_sync_log" to "service_role";

grant insert on table "public"."deck_identifiers_sync_log" to "service_role";

grant references on table "public"."deck_identifiers_sync_log" to "service_role";

grant select on table "public"."deck_identifiers_sync_log" to "service_role";

grant trigger on table "public"."deck_identifiers_sync_log" to "service_role";

grant truncate on table "public"."deck_identifiers_sync_log" to "service_role";

grant update on table "public"."deck_identifiers_sync_log" to "service_role";

grant delete on table "public"."games" to "anon";

grant insert on table "public"."games" to "anon";

grant select on table "public"."games" to "anon";

grant update on table "public"."games" to "anon";

grant delete on table "public"."games" to "authenticated";

grant insert on table "public"."games" to "authenticated";

grant select on table "public"."games" to "authenticated";

grant update on table "public"."games" to "authenticated";

grant delete on table "public"."games" to "service_role";

grant insert on table "public"."games" to "service_role";

grant select on table "public"."games" to "service_role";

grant update on table "public"."games" to "service_role";

grant delete on table "public"."leaderboard_snapshots" to "anon";

grant insert on table "public"."leaderboard_snapshots" to "anon";

grant select on table "public"."leaderboard_snapshots" to "anon";

grant update on table "public"."leaderboard_snapshots" to "anon";

grant delete on table "public"."leaderboard_snapshots" to "authenticated";

grant insert on table "public"."leaderboard_snapshots" to "authenticated";

grant select on table "public"."leaderboard_snapshots" to "authenticated";

grant update on table "public"."leaderboard_snapshots" to "authenticated";

grant delete on table "public"."leaderboard_snapshots" to "service_role";

grant insert on table "public"."leaderboard_snapshots" to "service_role";

grant select on table "public"."leaderboard_snapshots" to "service_role";

grant update on table "public"."leaderboard_snapshots" to "service_role";

grant delete on table "public"."manager_games" to "anon";

grant insert on table "public"."manager_games" to "anon";

grant references on table "public"."manager_games" to "anon";

grant select on table "public"."manager_games" to "anon";

grant trigger on table "public"."manager_games" to "anon";

grant truncate on table "public"."manager_games" to "anon";

grant update on table "public"."manager_games" to "anon";

grant delete on table "public"."manager_games" to "authenticated";

grant insert on table "public"."manager_games" to "authenticated";

grant references on table "public"."manager_games" to "authenticated";

grant select on table "public"."manager_games" to "authenticated";

grant trigger on table "public"."manager_games" to "authenticated";

grant truncate on table "public"."manager_games" to "authenticated";

grant update on table "public"."manager_games" to "authenticated";

grant delete on table "public"."manager_games" to "service_role";

grant insert on table "public"."manager_games" to "service_role";

grant references on table "public"."manager_games" to "service_role";

grant select on table "public"."manager_games" to "service_role";

grant trigger on table "public"."manager_games" to "service_role";

grant truncate on table "public"."manager_games" to "service_role";

grant update on table "public"."manager_games" to "service_role";

grant delete on table "public"."player_games" to "anon";

grant insert on table "public"."player_games" to "anon";

grant references on table "public"."player_games" to "anon";

grant select on table "public"."player_games" to "anon";

grant trigger on table "public"."player_games" to "anon";

grant truncate on table "public"."player_games" to "anon";

grant update on table "public"."player_games" to "anon";

grant delete on table "public"."player_games" to "authenticated";

grant insert on table "public"."player_games" to "authenticated";

grant references on table "public"."player_games" to "authenticated";

grant select on table "public"."player_games" to "authenticated";

grant trigger on table "public"."player_games" to "authenticated";

grant truncate on table "public"."player_games" to "authenticated";

grant update on table "public"."player_games" to "authenticated";

grant delete on table "public"."player_games" to "service_role";

grant insert on table "public"."player_games" to "service_role";

grant references on table "public"."player_games" to "service_role";

grant select on table "public"."player_games" to "service_role";

grant trigger on table "public"."player_games" to "service_role";

grant truncate on table "public"."player_games" to "service_role";

grant update on table "public"."player_games" to "service_role";

grant delete on table "public"."player_tcg_ids" to "anon";

grant insert on table "public"."player_tcg_ids" to "anon";

grant references on table "public"."player_tcg_ids" to "anon";

grant select on table "public"."player_tcg_ids" to "anon";

grant trigger on table "public"."player_tcg_ids" to "anon";

grant truncate on table "public"."player_tcg_ids" to "anon";

grant update on table "public"."player_tcg_ids" to "anon";

grant delete on table "public"."player_tcg_ids" to "authenticated";

grant insert on table "public"."player_tcg_ids" to "authenticated";

grant references on table "public"."player_tcg_ids" to "authenticated";

grant select on table "public"."player_tcg_ids" to "authenticated";

grant trigger on table "public"."player_tcg_ids" to "authenticated";

grant truncate on table "public"."player_tcg_ids" to "authenticated";

grant update on table "public"."player_tcg_ids" to "authenticated";

grant delete on table "public"."player_tcg_ids" to "service_role";

grant insert on table "public"."player_tcg_ids" to "service_role";

grant references on table "public"."player_tcg_ids" to "service_role";

grant select on table "public"."player_tcg_ids" to "service_role";

grant trigger on table "public"."player_tcg_ids" to "service_role";

grant truncate on table "public"."player_tcg_ids" to "service_role";

grant update on table "public"."player_tcg_ids" to "service_role";

grant delete on table "public"."players" to "anon";

grant insert on table "public"."players" to "anon";

grant select on table "public"."players" to "anon";

grant update on table "public"."players" to "anon";

grant delete on table "public"."players" to "authenticated";

grant insert on table "public"."players" to "authenticated";

grant select on table "public"."players" to "authenticated";

grant update on table "public"."players" to "authenticated";

grant delete on table "public"."players" to "service_role";

grant insert on table "public"."players" to "service_role";

grant select on table "public"."players" to "service_role";

grant update on table "public"."players" to "service_role";

grant delete on table "public"."round_appeals" to "anon";

grant insert on table "public"."round_appeals" to "anon";

grant references on table "public"."round_appeals" to "anon";

grant select on table "public"."round_appeals" to "anon";

grant trigger on table "public"."round_appeals" to "anon";

grant truncate on table "public"."round_appeals" to "anon";

grant update on table "public"."round_appeals" to "anon";

grant delete on table "public"."round_appeals" to "authenticated";

grant insert on table "public"."round_appeals" to "authenticated";

grant references on table "public"."round_appeals" to "authenticated";

grant select on table "public"."round_appeals" to "authenticated";

grant trigger on table "public"."round_appeals" to "authenticated";

grant truncate on table "public"."round_appeals" to "authenticated";

grant update on table "public"."round_appeals" to "authenticated";

grant delete on table "public"."round_appeals" to "service_role";

grant insert on table "public"."round_appeals" to "service_role";

grant references on table "public"."round_appeals" to "service_role";

grant select on table "public"."round_appeals" to "service_role";

grant trigger on table "public"."round_appeals" to "service_role";

grant truncate on table "public"."round_appeals" to "service_role";

grant update on table "public"."round_appeals" to "service_role";

grant delete on table "public"."seasons" to "anon";

grant insert on table "public"."seasons" to "anon";

grant references on table "public"."seasons" to "anon";

grant select on table "public"."seasons" to "anon";

grant trigger on table "public"."seasons" to "anon";

grant truncate on table "public"."seasons" to "anon";

grant update on table "public"."seasons" to "anon";

grant delete on table "public"."seasons" to "authenticated";

grant insert on table "public"."seasons" to "authenticated";

grant references on table "public"."seasons" to "authenticated";

grant select on table "public"."seasons" to "authenticated";

grant trigger on table "public"."seasons" to "authenticated";

grant truncate on table "public"."seasons" to "authenticated";

grant update on table "public"."seasons" to "authenticated";

grant delete on table "public"."seasons" to "service_role";

grant insert on table "public"."seasons" to "service_role";

grant references on table "public"."seasons" to "service_role";

grant select on table "public"."seasons" to "service_role";

grant trigger on table "public"."seasons" to "service_role";

grant truncate on table "public"."seasons" to "service_role";

grant update on table "public"."seasons" to "service_role";

grant delete on table "public"."session_link_events" to "anon";

grant insert on table "public"."session_link_events" to "anon";

grant references on table "public"."session_link_events" to "anon";

grant select on table "public"."session_link_events" to "anon";

grant trigger on table "public"."session_link_events" to "anon";

grant truncate on table "public"."session_link_events" to "anon";

grant update on table "public"."session_link_events" to "anon";

grant delete on table "public"."session_link_events" to "authenticated";

grant insert on table "public"."session_link_events" to "authenticated";

grant references on table "public"."session_link_events" to "authenticated";

grant select on table "public"."session_link_events" to "authenticated";

grant trigger on table "public"."session_link_events" to "authenticated";

grant truncate on table "public"."session_link_events" to "authenticated";

grant update on table "public"."session_link_events" to "authenticated";

grant delete on table "public"."session_link_events" to "service_role";

grant insert on table "public"."session_link_events" to "service_role";

grant references on table "public"."session_link_events" to "service_role";

grant select on table "public"."session_link_events" to "service_role";

grant trigger on table "public"."session_link_events" to "service_role";

grant truncate on table "public"."session_link_events" to "service_role";

grant update on table "public"."session_link_events" to "service_role";

grant delete on table "public"."sponsor_view_metrics" to "anon";

grant insert on table "public"."sponsor_view_metrics" to "anon";

grant references on table "public"."sponsor_view_metrics" to "anon";

grant select on table "public"."sponsor_view_metrics" to "anon";

grant trigger on table "public"."sponsor_view_metrics" to "anon";

grant truncate on table "public"."sponsor_view_metrics" to "anon";

grant update on table "public"."sponsor_view_metrics" to "anon";

grant delete on table "public"."sponsor_view_metrics" to "authenticated";

grant insert on table "public"."sponsor_view_metrics" to "authenticated";

grant references on table "public"."sponsor_view_metrics" to "authenticated";

grant select on table "public"."sponsor_view_metrics" to "authenticated";

grant trigger on table "public"."sponsor_view_metrics" to "authenticated";

grant truncate on table "public"."sponsor_view_metrics" to "authenticated";

grant update on table "public"."sponsor_view_metrics" to "authenticated";

grant delete on table "public"."sponsor_view_metrics" to "service_role";

grant insert on table "public"."sponsor_view_metrics" to "service_role";

grant references on table "public"."sponsor_view_metrics" to "service_role";

grant select on table "public"."sponsor_view_metrics" to "service_role";

grant trigger on table "public"."sponsor_view_metrics" to "service_role";

grant truncate on table "public"."sponsor_view_metrics" to "service_role";

grant update on table "public"."sponsor_view_metrics" to "service_role";

grant delete on table "public"."sponsors" to "anon";

grant insert on table "public"."sponsors" to "anon";

grant references on table "public"."sponsors" to "anon";

grant select on table "public"."sponsors" to "anon";

grant trigger on table "public"."sponsors" to "anon";

grant truncate on table "public"."sponsors" to "anon";

grant update on table "public"."sponsors" to "anon";

grant delete on table "public"."sponsors" to "authenticated";

grant insert on table "public"."sponsors" to "authenticated";

grant references on table "public"."sponsors" to "authenticated";

grant select on table "public"."sponsors" to "authenticated";

grant trigger on table "public"."sponsors" to "authenticated";

grant truncate on table "public"."sponsors" to "authenticated";

grant update on table "public"."sponsors" to "authenticated";

grant delete on table "public"."sponsors" to "service_role";

grant insert on table "public"."sponsors" to "service_role";

grant references on table "public"."sponsors" to "service_role";

grant select on table "public"."sponsors" to "service_role";

grant trigger on table "public"."sponsors" to "service_role";

grant truncate on table "public"."sponsors" to "service_role";

grant update on table "public"."sponsors" to "service_role";

grant delete on table "public"."standalone_round_results" to "anon";

grant insert on table "public"."standalone_round_results" to "anon";

grant references on table "public"."standalone_round_results" to "anon";

grant select on table "public"."standalone_round_results" to "anon";

grant trigger on table "public"."standalone_round_results" to "anon";

grant truncate on table "public"."standalone_round_results" to "anon";

grant update on table "public"."standalone_round_results" to "anon";

grant delete on table "public"."standalone_round_results" to "authenticated";

grant insert on table "public"."standalone_round_results" to "authenticated";

grant references on table "public"."standalone_round_results" to "authenticated";

grant select on table "public"."standalone_round_results" to "authenticated";

grant trigger on table "public"."standalone_round_results" to "authenticated";

grant truncate on table "public"."standalone_round_results" to "authenticated";

grant update on table "public"."standalone_round_results" to "authenticated";

grant delete on table "public"."standalone_round_results" to "service_role";

grant insert on table "public"."standalone_round_results" to "service_role";

grant references on table "public"."standalone_round_results" to "service_role";

grant select on table "public"."standalone_round_results" to "service_role";

grant trigger on table "public"."standalone_round_results" to "service_role";

grant truncate on table "public"."standalone_round_results" to "service_role";

grant update on table "public"."standalone_round_results" to "service_role";

grant delete on table "public"."standalone_sessions" to "anon";

grant insert on table "public"."standalone_sessions" to "anon";

grant references on table "public"."standalone_sessions" to "anon";

grant select on table "public"."standalone_sessions" to "anon";

grant trigger on table "public"."standalone_sessions" to "anon";

grant truncate on table "public"."standalone_sessions" to "anon";

grant update on table "public"."standalone_sessions" to "anon";

grant delete on table "public"."standalone_sessions" to "authenticated";

grant insert on table "public"."standalone_sessions" to "authenticated";

grant references on table "public"."standalone_sessions" to "authenticated";

grant select on table "public"."standalone_sessions" to "authenticated";

grant trigger on table "public"."standalone_sessions" to "authenticated";

grant truncate on table "public"."standalone_sessions" to "authenticated";

grant update on table "public"."standalone_sessions" to "authenticated";

grant delete on table "public"."standalone_sessions" to "service_role";

grant insert on table "public"."standalone_sessions" to "service_role";

grant references on table "public"."standalone_sessions" to "service_role";

grant select on table "public"."standalone_sessions" to "service_role";

grant trigger on table "public"."standalone_sessions" to "service_role";

grant truncate on table "public"."standalone_sessions" to "service_role";

grant update on table "public"."standalone_sessions" to "service_role";

grant delete on table "public"."store_analytics_settings" to "anon";

grant insert on table "public"."store_analytics_settings" to "anon";

grant references on table "public"."store_analytics_settings" to "anon";

grant select on table "public"."store_analytics_settings" to "anon";

grant trigger on table "public"."store_analytics_settings" to "anon";

grant truncate on table "public"."store_analytics_settings" to "anon";

grant update on table "public"."store_analytics_settings" to "anon";

grant delete on table "public"."store_analytics_settings" to "authenticated";

grant insert on table "public"."store_analytics_settings" to "authenticated";

grant references on table "public"."store_analytics_settings" to "authenticated";

grant select on table "public"."store_analytics_settings" to "authenticated";

grant trigger on table "public"."store_analytics_settings" to "authenticated";

grant truncate on table "public"."store_analytics_settings" to "authenticated";

grant update on table "public"."store_analytics_settings" to "authenticated";

grant delete on table "public"."store_analytics_settings" to "service_role";

grant insert on table "public"."store_analytics_settings" to "service_role";

grant references on table "public"."store_analytics_settings" to "service_role";

grant select on table "public"."store_analytics_settings" to "service_role";

grant trigger on table "public"."store_analytics_settings" to "service_role";

grant truncate on table "public"."store_analytics_settings" to "service_role";

grant update on table "public"."store_analytics_settings" to "service_role";

grant delete on table "public"."store_schedules" to "anon";

grant insert on table "public"."store_schedules" to "anon";

grant references on table "public"."store_schedules" to "anon";

grant select on table "public"."store_schedules" to "anon";

grant trigger on table "public"."store_schedules" to "anon";

grant truncate on table "public"."store_schedules" to "anon";

grant update on table "public"."store_schedules" to "anon";

grant delete on table "public"."store_schedules" to "authenticated";

grant insert on table "public"."store_schedules" to "authenticated";

grant references on table "public"."store_schedules" to "authenticated";

grant select on table "public"."store_schedules" to "authenticated";

grant trigger on table "public"."store_schedules" to "authenticated";

grant truncate on table "public"."store_schedules" to "authenticated";

grant update on table "public"."store_schedules" to "authenticated";

grant delete on table "public"."store_schedules" to "service_role";

grant insert on table "public"."store_schedules" to "service_role";

grant references on table "public"."store_schedules" to "service_role";

grant select on table "public"."store_schedules" to "service_role";

grant trigger on table "public"."store_schedules" to "service_role";

grant truncate on table "public"."store_schedules" to "service_role";

grant update on table "public"."store_schedules" to "service_role";

grant delete on table "public"."stores" to "anon";

grant insert on table "public"."stores" to "anon";

grant select on table "public"."stores" to "anon";

grant update on table "public"."stores" to "anon";

grant delete on table "public"."stores" to "authenticated";

grant insert on table "public"."stores" to "authenticated";

grant select on table "public"."stores" to "authenticated";

grant update on table "public"."stores" to "authenticated";

grant delete on table "public"."stores" to "service_role";

grant insert on table "public"."stores" to "service_role";

grant select on table "public"."stores" to "service_role";

grant update on table "public"."stores" to "service_role";

grant delete on table "public"."tournament_results" to "anon";

grant insert on table "public"."tournament_results" to "anon";

grant select on table "public"."tournament_results" to "anon";

grant update on table "public"."tournament_results" to "anon";

grant delete on table "public"."tournament_results" to "authenticated";

grant insert on table "public"."tournament_results" to "authenticated";

grant select on table "public"."tournament_results" to "authenticated";

grant update on table "public"."tournament_results" to "authenticated";

grant delete on table "public"."tournament_results" to "service_role";

grant insert on table "public"."tournament_results" to "service_role";

grant select on table "public"."tournament_results" to "service_role";

grant update on table "public"."tournament_results" to "service_role";

grant delete on table "public"."tournament_round_results" to "anon";

grant insert on table "public"."tournament_round_results" to "anon";

grant references on table "public"."tournament_round_results" to "anon";

grant select on table "public"."tournament_round_results" to "anon";

grant trigger on table "public"."tournament_round_results" to "anon";

grant truncate on table "public"."tournament_round_results" to "anon";

grant update on table "public"."tournament_round_results" to "anon";

grant delete on table "public"."tournament_round_results" to "authenticated";

grant insert on table "public"."tournament_round_results" to "authenticated";

grant references on table "public"."tournament_round_results" to "authenticated";

grant select on table "public"."tournament_round_results" to "authenticated";

grant trigger on table "public"."tournament_round_results" to "authenticated";

grant truncate on table "public"."tournament_round_results" to "authenticated";

grant update on table "public"."tournament_round_results" to "authenticated";

grant delete on table "public"."tournament_round_results" to "service_role";

grant insert on table "public"."tournament_round_results" to "service_role";

grant references on table "public"."tournament_round_results" to "service_role";

grant select on table "public"."tournament_round_results" to "service_role";

grant trigger on table "public"."tournament_round_results" to "service_role";

grant truncate on table "public"."tournament_round_results" to "service_role";

grant update on table "public"."tournament_round_results" to "service_role";

grant delete on table "public"."tournaments" to "anon";

grant insert on table "public"."tournaments" to "anon";

grant select on table "public"."tournaments" to "anon";

grant update on table "public"."tournaments" to "anon";

grant delete on table "public"."tournaments" to "authenticated";

grant insert on table "public"."tournaments" to "authenticated";

grant select on table "public"."tournaments" to "authenticated";

grant update on table "public"."tournaments" to "authenticated";

grant delete on table "public"."tournaments" to "service_role";

grant insert on table "public"."tournaments" to "service_role";

grant select on table "public"."tournaments" to "service_role";

grant update on table "public"."tournaments" to "service_role";


  create policy "ad_metrics_public_read"
  on "public"."ad_metrics"
  as permissive
  for select
  to public
using (true);



  create policy "audit_log_admin_only"
  on "public"."admin_audit_log"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.players
  WHERE ((players.auth_user_id = auth.uid()) AND (players.role = 'admin'::text)))));



  create policy "Public read games"
  on "public"."games"
  as permissive
  for select
  to public
using (true);



  create policy "Public read leaderboard"
  on "public"."leaderboard_snapshots"
  as permissive
  for select
  to public
using (true);



  create policy "manager_games_public_read"
  on "public"."manager_games"
  as permissive
  for select
  to public
using (true);



  create policy "player_games readable by all"
  on "public"."player_games"
  as permissive
  for select
  to public
using (true);



  create policy "player_tcg_ids_admin_all"
  on "public"."player_tcg_ids"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.players
  WHERE ((players.auth_user_id = auth.uid()) AND (players.role = 'admin'::text)))));



  create policy "player_tcg_ids_admin_read"
  on "public"."player_tcg_ids"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.players
  WHERE ((players.auth_user_id = auth.uid()) AND (players.role = ANY (ARRAY['admin'::text, 'tcg_manager'::text]))))));



  create policy "player_tcg_ids_own_read"
  on "public"."player_tcg_ids"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.players
  WHERE ((players.id = player_tcg_ids.player_id) AND (players.auth_user_id = auth.uid())))));



  create policy "player_tcg_ids_own_write"
  on "public"."player_tcg_ids"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.players
  WHERE ((players.id = player_tcg_ids.player_id) AND (players.auth_user_id = auth.uid())))));



  create policy "Public read players safe"
  on "public"."players"
  as permissive
  for select
  to anon, authenticated
using ((is_profile_public = true));



  create policy "players_read_own"
  on "public"."players"
  as permissive
  for select
  to public
using ((auth.uid() = auth_user_id));



  create policy "players_update_own"
  on "public"."players"
  as permissive
  for update
  to public
using ((auth.uid() = auth_user_id));



  create policy "seasons_public_read"
  on "public"."seasons"
  as permissive
  for select
  to public
using (true);



  create policy "player can read own link events"
  on "public"."session_link_events"
  as permissive
  for select
  to authenticated
using ((actor_player_id = auth.uid()));



  create policy "service role bypass session_link_events"
  on "public"."session_link_events"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "sponsors_admin_all"
  on "public"."sponsors"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.players
  WHERE ((players.auth_user_id = auth.uid()) AND (players.role = 'admin'::text)))));



  create policy "sponsors_public_read"
  on "public"."sponsors"
  as permissive
  for select
  to public
using ((is_active = true));



  create policy "player can delete own standalone rounds"
  on "public"."standalone_round_results"
  as permissive
  for delete
  to authenticated
using ((player_id = auth.uid()));



  create policy "player can insert own standalone rounds"
  on "public"."standalone_round_results"
  as permissive
  for insert
  to authenticated
with check ((player_id = auth.uid()));



  create policy "player can read own standalone rounds"
  on "public"."standalone_round_results"
  as permissive
  for select
  to authenticated
using ((player_id = auth.uid()));



  create policy "player can update own standalone rounds"
  on "public"."standalone_round_results"
  as permissive
  for update
  to authenticated
using ((player_id = auth.uid()));



  create policy "service role bypass standalone_rounds"
  on "public"."standalone_round_results"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "player can delete own unlinked sessions"
  on "public"."standalone_sessions"
  as permissive
  for delete
  to authenticated
using (((player_id = auth.uid()) AND (status = ANY (ARRAY['unlinked'::text, 'casual'::text]))));



  create policy "player can insert own sessions"
  on "public"."standalone_sessions"
  as permissive
  for insert
  to authenticated
with check ((player_id = auth.uid()));



  create policy "player can read own sessions"
  on "public"."standalone_sessions"
  as permissive
  for select
  to authenticated
using ((player_id = auth.uid()));



  create policy "player can update own sessions"
  on "public"."standalone_sessions"
  as permissive
  for update
  to authenticated
using ((player_id = auth.uid()));



  create policy "service role bypass standalone_sessions"
  on "public"."standalone_sessions"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "store_schedules_public_read"
  on "public"."store_schedules"
  as permissive
  for select
  to public
using (true);



  create policy "Public read stores"
  on "public"."stores"
  as permissive
  for select
  to public
using (true);



  create policy "Public read results"
  on "public"."tournament_results"
  as permissive
  for select
  to public
using (true);



  create policy "player can confirm own rounds"
  on "public"."tournament_round_results"
  as permissive
  for update
  to authenticated
using ((player_id = auth.uid()))
with check ((player_id = auth.uid()));



  create policy "service role bypass"
  on "public"."tournament_round_results"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "Public read tournaments"
  on "public"."tournaments"
  as permissive
  for select
  to public
using ((status = ANY (ARRAY['PUBLISHED'::public.tournament_status, 'APPROVED'::public.tournament_status])));


CREATE TRIGGER trg_normalize_tcg_id BEFORE INSERT OR UPDATE ON public.player_tcg_ids FOR EACH ROW EXECUTE FUNCTION public.normalize_tcg_id();

CREATE TRIGGER trg_match_standalone_on_publish AFTER UPDATE OF status ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.fn_match_standalone_sessions_on_publish();



export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ad_metrics: {
        Row: {
          current_sponsor_id: string | null
          id: string
          total_cycles: number
          total_views: number
          updated_at: string
        }
        Insert: {
          current_sponsor_id?: string | null
          id?: string
          total_cycles?: number
          total_views?: number
          updated_at?: string
        }
        Update: {
          current_sponsor_id?: string | null
          id?: string
          total_cycles?: number
          total_views?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_metrics_current_sponsor_id_fkey"
            columns: ["current_sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsor_metrics_current_month"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_metrics_current_sponsor_id_fkey"
            columns: ["current_sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string
          actor_role: string
          actor_tag: string
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_label: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id: string
          actor_role: string
          actor_tag?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_label?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string
          actor_role?: string
          actor_tag?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_label?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "public_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_identifiers: {
        Row: {
          api_source: string | null
          base_name: string
          canonical_leader_id: string | null
          card_image: string | null
          card_image_id: string | null
          card_name: string
          card_set_id: string | null
          colors: string[] | null
          created_at: string | null
          created_by: string | null
          game_id: string
          id: string
          identifier_type: string
          is_active: boolean
          rarity: string | null
          set_code: string | null
          set_name: string | null
          source: string
          synced_at: string | null
        }
        Insert: {
          api_source?: string | null
          base_name: string
          canonical_leader_id?: string | null
          card_image?: string | null
          card_image_id?: string | null
          card_name: string
          card_set_id?: string | null
          colors?: string[] | null
          created_at?: string | null
          created_by?: string | null
          game_id: string
          id?: string
          identifier_type: string
          is_active?: boolean
          rarity?: string | null
          set_code?: string | null
          set_name?: string | null
          source: string
          synced_at?: string | null
        }
        Update: {
          api_source?: string | null
          base_name?: string
          canonical_leader_id?: string | null
          card_image?: string | null
          card_image_id?: string | null
          card_name?: string
          card_set_id?: string | null
          colors?: string[] | null
          created_at?: string | null
          created_by?: string | null
          game_id?: string
          id?: string
          identifier_type?: string
          is_active?: boolean
          rarity?: string | null
          set_code?: string | null
          set_name?: string | null
          source?: string
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deck_identifiers_canonical_leader_id_fkey"
            columns: ["canonical_leader_id"]
            isOneToOne: false
            referencedRelation: "deck_identifiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deck_identifiers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deck_identifiers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deck_identifiers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deck_identifiers_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_identifiers_sync_log: {
        Row: {
          error_message: string | null
          game_id: string
          id: string
          leaders_added: number
          leaders_deactivated: number
          leaders_updated: number
          status: string
          synced_at: string
        }
        Insert: {
          error_message?: string | null
          game_id: string
          id?: string
          leaders_added?: number
          leaders_deactivated?: number
          leaders_updated?: number
          status: string
          synced_at?: string
        }
        Update: {
          error_message?: string | null
          game_id?: string
          id?: string
          leaders_added?: number
          leaders_deactivated?: number
          leaders_updated?: number
          status?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deck_identifiers_sync_log_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          publisher: string | null
          slug: string
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          publisher?: string | null
          slug: string
        }
        Update: {
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          publisher?: string | null
          slug?: string
        }
        Relationships: []
      }
      leaderboard_snapshots: {
        Row: {
          game_id: string
          id: string
          last_updated_at: string | null
          omw_percentage: number | null
          player_id: string
          rank_position: number | null
          season_id: string | null
          store_id: string | null
          timeframe_type: Database["public"]["Enums"]["timeframe_type"]
          timeframe_value: string
          total_points: number | null
          tournaments_played: number | null
          tournaments_won: number | null
        }
        Insert: {
          game_id: string
          id?: string
          last_updated_at?: string | null
          omw_percentage?: number | null
          player_id: string
          rank_position?: number | null
          season_id?: string | null
          store_id?: string | null
          timeframe_type: Database["public"]["Enums"]["timeframe_type"]
          timeframe_value: string
          total_points?: number | null
          tournaments_played?: number | null
          tournaments_won?: number | null
        }
        Update: {
          game_id?: string
          id?: string
          last_updated_at?: string | null
          omw_percentage?: number | null
          player_id?: string
          rank_position?: number | null
          season_id?: string | null
          store_id?: string | null
          timeframe_type?: Database["public"]["Enums"]["timeframe_type"]
          timeframe_value?: string
          total_points?: number | null
          tournaments_played?: number | null
          tournaments_won?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_snapshots_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_snapshots_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_snapshots_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_snapshots_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_snapshots_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_snapshots_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_games: {
        Row: {
          created_at: string
          game_id: string
          id: string
          player_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          player_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_games_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_games_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_games_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_games_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          player_id: string
          read_at: string | null
          title: string
          type: string
          url: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          player_id: string
          read_at?: string | null
          title: string
          type: string
          url?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          player_id?: string
          read_at?: string | null
          title?: string
          type?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      player_favorite_stores: {
        Row: {
          created_at: string
          id: string
          player_id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          player_id: string
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          player_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_favorite_stores_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_favorite_stores_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_favorite_stores_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_favorite_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      player_games: {
        Row: {
          created_at: string
          game_id: string
          id: string
          player_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          player_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_games_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_games_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_games_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_games_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      player_tcg_ids: {
        Row: {
          created_at: string
          game_id: string
          id: string
          player_id: string
          tcg_user_id: string
          tcg_user_id_normalized: string | null
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          player_id: string
          tcg_user_id: string
          tcg_user_id_normalized?: string | null
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          player_id?: string
          tcg_user_id?: string
          tcg_user_id_normalized?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_tcg_ids_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_tcg_ids_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_tcg_ids_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_tcg_ids_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          birth_date: string | null
          contact_backup: string | null
          contact_primary: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          geek_tag: string
          gender: string | null
          home_store_id: string | null
          id: string
          is_active: boolean | null
          is_profile_public: boolean
          preferences_prompted_at: string | null
          preferred_game_id: string | null
          preferred_zone: string | null
          role: string
          work_schedule: string | null
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          contact_backup?: string | null
          contact_primary?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          geek_tag: string
          gender?: string | null
          home_store_id?: string | null
          id?: string
          is_active?: boolean | null
          is_profile_public?: boolean
          preferences_prompted_at?: string | null
          preferred_game_id?: string | null
          preferred_zone?: string | null
          role?: string
          work_schedule?: string | null
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          contact_backup?: string | null
          contact_primary?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          geek_tag?: string
          gender?: string | null
          home_store_id?: string | null
          id?: string
          is_active?: boolean | null
          is_profile_public?: boolean
          preferences_prompted_at?: string | null
          preferred_game_id?: string | null
          preferred_zone?: string | null
          role?: string
          work_schedule?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_home_store_id_fkey"
            columns: ["home_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_preferred_game_id_fkey"
            columns: ["preferred_game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id?: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      round_appeals: {
        Row: {
          appellant_player_id: string
          created_at: string | null
          id: string
          original_opponent_leader_id: string | null
          original_player_leader_id: string | null
          original_round_id: string
          original_turn_order: string | null
          original_won_die_roll: boolean | null
          original_won_match: boolean | null
          proposed_opponent_leader_id: string | null
          proposed_player_leader_id: string | null
          proposed_turn_order: string | null
          proposed_won_die_roll: boolean | null
          proposed_won_match: boolean | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          round_number: number
          status: string
          store_id: string
          tournament_id: string
        }
        Insert: {
          appellant_player_id: string
          created_at?: string | null
          id?: string
          original_opponent_leader_id?: string | null
          original_player_leader_id?: string | null
          original_round_id: string
          original_turn_order?: string | null
          original_won_die_roll?: boolean | null
          original_won_match?: boolean | null
          proposed_opponent_leader_id?: string | null
          proposed_player_leader_id?: string | null
          proposed_turn_order?: string | null
          proposed_won_die_roll?: boolean | null
          proposed_won_match?: boolean | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          round_number: number
          status?: string
          store_id: string
          tournament_id: string
        }
        Update: {
          appellant_player_id?: string
          created_at?: string | null
          id?: string
          original_opponent_leader_id?: string | null
          original_player_leader_id?: string | null
          original_round_id?: string
          original_turn_order?: string | null
          original_won_die_roll?: boolean | null
          original_won_match?: boolean | null
          proposed_opponent_leader_id?: string | null
          proposed_player_leader_id?: string | null
          proposed_turn_order?: string | null
          proposed_won_die_roll?: boolean | null
          proposed_won_match?: boolean | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          round_number?: number
          status?: string
          store_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_appeals_appellant_player_id_fkey"
            columns: ["appellant_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_appeals_appellant_player_id_fkey"
            columns: ["appellant_player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_appeals_appellant_player_id_fkey"
            columns: ["appellant_player_id"]
            isOneToOne: false
            referencedRelation: "public_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_appeals_original_opponent_leader_id_fkey"
            columns: ["original_opponent_leader_id"]
            isOneToOne: false
            referencedRelation: "deck_identifiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_appeals_original_player_leader_id_fkey"
            columns: ["original_player_leader_id"]
            isOneToOne: false
            referencedRelation: "deck_identifiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_appeals_original_round_id_fkey"
            columns: ["original_round_id"]
            isOneToOne: false
            referencedRelation: "tournament_round_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_appeals_proposed_opponent_leader_id_fkey"
            columns: ["proposed_opponent_leader_id"]
            isOneToOne: false
            referencedRelation: "deck_identifiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_appeals_proposed_player_leader_id_fkey"
            columns: ["proposed_player_leader_id"]
            isOneToOne: false
            referencedRelation: "deck_identifiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_appeals_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_appeals_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_appeals_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "public_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_appeals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_appeals_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          name: string
          slug: string
          start_date: string
          status: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          start_date: string
          status?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          start_date?: string
          status?: string
        }
        Relationships: []
      }
      session_link_events: {
        Row: {
          actor_player_id: string | null
          created_at: string
          event_type: string
          id: string
          session_id: string
          tournament_id: string | null
        }
        Insert: {
          actor_player_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          session_id: string
          tournament_id?: string | null
        }
        Update: {
          actor_player_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          session_id?: string
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_link_events_actor_player_id_fkey"
            columns: ["actor_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_link_events_actor_player_id_fkey"
            columns: ["actor_player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_link_events_actor_player_id_fkey"
            columns: ["actor_player_id"]
            isOneToOne: false
            referencedRelation: "public_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_link_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "standalone_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_link_events_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_view_metrics: {
        Row: {
          created_at: string
          cycles_count: number
          id: string
          month_year: string
          sponsor_id: string
          updated_at: string
          views_count: number
        }
        Insert: {
          created_at?: string
          cycles_count?: number
          id?: string
          month_year: string
          sponsor_id: string
          updated_at?: string
          views_count?: number
        }
        Update: {
          created_at?: string
          cycles_count?: number
          id?: string
          month_year?: string
          sponsor_id?: string
          updated_at?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_view_metrics_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsor_metrics_current_month"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsor_view_metrics_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors: {
        Row: {
          carousel_url: string | null
          created_at: string
          cycles_count: number
          display_order: number | null
          horizontal_url: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          priority_rank: number
          vertical_url: string | null
          view_limit: number
          views_count: number
        }
        Insert: {
          carousel_url?: string | null
          created_at?: string
          cycles_count?: number
          display_order?: number | null
          horizontal_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          priority_rank: number
          vertical_url?: string | null
          view_limit?: number
          views_count?: number
        }
        Update: {
          carousel_url?: string | null
          created_at?: string
          cycles_count?: number
          display_order?: number | null
          horizontal_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          priority_rank?: number
          vertical_url?: string | null
          view_limit?: number
          views_count?: number
        }
        Relationships: []
      }
      standalone_round_results: {
        Row: {
          created_at: string
          id: string
          is_auto_populated: boolean
          is_bye: boolean
          notes: string | null
          opponent_leader_id: string | null
          opponent_player_id: string | null
          player_id: string
          player_leader_id: string | null
          reporter_player_id: string | null
          round_number: number
          session_id: string
          status: string
          turn_order: string | null
          updated_at: string
          won_die_roll: boolean | null
          won_match: boolean | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_auto_populated?: boolean
          is_bye?: boolean
          notes?: string | null
          opponent_leader_id?: string | null
          opponent_player_id?: string | null
          player_id: string
          player_leader_id?: string | null
          reporter_player_id?: string | null
          round_number: number
          session_id: string
          status?: string
          turn_order?: string | null
          updated_at?: string
          won_die_roll?: boolean | null
          won_match?: boolean | null
        }
        Update: {
          created_at?: string
          id?: string
          is_auto_populated?: boolean
          is_bye?: boolean
          notes?: string | null
          opponent_leader_id?: string | null
          opponent_player_id?: string | null
          player_id?: string
          player_leader_id?: string | null
          reporter_player_id?: string | null
          round_number?: number
          session_id?: string
          status?: string
          turn_order?: string | null
          updated_at?: string
          won_die_roll?: boolean | null
          won_match?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "standalone_round_results_opponent_leader_id_fkey"
            columns: ["opponent_leader_id"]
            isOneToOne: false
            referencedRelation: "deck_identifiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_round_results_opponent_player_id_fkey"
            columns: ["opponent_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_round_results_opponent_player_id_fkey"
            columns: ["opponent_player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_round_results_opponent_player_id_fkey"
            columns: ["opponent_player_id"]
            isOneToOne: false
            referencedRelation: "public_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_round_results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_round_results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_round_results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_round_results_player_leader_id_fkey"
            columns: ["player_leader_id"]
            isOneToOne: false
            referencedRelation: "deck_identifiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_round_results_reporter_player_id_fkey"
            columns: ["reporter_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_round_results_reporter_player_id_fkey"
            columns: ["reporter_player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_round_results_reporter_player_id_fkey"
            columns: ["reporter_player_id"]
            isOneToOne: false
            referencedRelation: "public_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_round_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "standalone_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      standalone_sessions: {
        Row: {
          created_at: string
          game_id: string
          id: string
          name: string
          player_id: string
          player_leader_id: string | null
          session_date: string | null
          session_time: string | null
          session_type: string
          status: string
          store_id: string | null
          tournament_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          name: string
          player_id: string
          player_leader_id?: string | null
          session_date?: string | null
          session_time?: string | null
          session_type: string
          status?: string
          store_id?: string | null
          tournament_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          name?: string
          player_id?: string
          player_leader_id?: string | null
          session_date?: string | null
          session_time?: string | null
          session_type?: string
          status?: string
          store_id?: string | null
          tournament_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "standalone_sessions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_sessions_player_leader_id_fkey"
            columns: ["player_leader_id"]
            isOneToOne: false
            referencedRelation: "deck_identifiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_sessions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      store_analytics_settings: {
        Row: {
          at_risk_threshold_days: number
          created_at: string | null
          id: string
          inactive_threshold_days: number
          store_id: string
          updated_at: string | null
        }
        Insert: {
          at_risk_threshold_days?: number
          created_at?: string | null
          id?: string
          inactive_threshold_days?: number
          store_id: string
          updated_at?: string | null
        }
        Update: {
          at_risk_threshold_days?: number
          created_at?: string | null
          id?: string
          inactive_threshold_days?: number
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_analytics_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_league_prizes: {
        Row: {
          description: string
          id: string
          image_url: string | null
          league_id: string
          sort_order: number
        }
        Insert: {
          description: string
          id?: string
          image_url?: string | null
          league_id: string
          sort_order?: number
        }
        Update: {
          description?: string
          id?: string
          image_url?: string | null
          league_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_league_prizes_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "store_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      store_league_schedule_overrides: {
        Row: {
          created_at: string
          id: string
          label: string | null
          league_schedule_id: string
          occurrence_date: string
          start_time: string | null
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          league_schedule_id: string
          occurrence_date: string
          start_time?: string | null
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          league_schedule_id?: string
          occurrence_date?: string
          start_time?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_league_schedule_overrides_league_schedule_id_fkey"
            columns: ["league_schedule_id"]
            isOneToOne: false
            referencedRelation: "store_league_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_league_schedule_overrides_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_league_schedules: {
        Row: {
          created_at: string
          day_of_week: number
          game_id: string
          id: string
          league_id: string
          national_schedule_id: string | null
          shares_national_slot: boolean
          start_time: string
          store_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          game_id: string
          id?: string
          league_id: string
          national_schedule_id?: string | null
          shares_national_slot?: boolean
          start_time: string
          store_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          game_id?: string
          id?: string
          league_id?: string
          national_schedule_id?: string | null
          shares_national_slot?: boolean
          start_time?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_league_schedules_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_league_schedules_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "store_leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_league_schedules_national_schedule_id_fkey"
            columns: ["national_schedule_id"]
            isOneToOne: false
            referencedRelation: "store_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_league_schedules_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_league_tournaments: {
        Row: {
          added_at: string
          league_id: string
          tournament_id: string
        }
        Insert: {
          added_at?: string
          league_id: string
          tournament_id: string
        }
        Update: {
          added_at?: string
          league_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_league_tournaments_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "store_leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_league_tournaments_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      store_leagues: {
        Row: {
          active_weekdays: number[]
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          name: string
          start_date: string
          status: string
          store_id: string
          winner_player_id: string | null
          winner_points: number | null
        }
        Insert: {
          active_weekdays?: number[]
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          name: string
          start_date: string
          status?: string
          store_id: string
          winner_player_id?: string | null
          winner_points?: number | null
        }
        Update: {
          active_weekdays?: number[]
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          status?: string
          store_id?: string
          winner_player_id?: string | null
          winner_points?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "store_leagues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_leagues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_leagues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_leagues_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_leagues_winner_player_id_fkey"
            columns: ["winner_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_leagues_winner_player_id_fkey"
            columns: ["winner_player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_leagues_winner_player_id_fkey"
            columns: ["winner_player_id"]
            isOneToOne: false
            referencedRelation: "public_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      store_page_views: {
        Row: {
          id: string
          section: string
          store_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          section: string
          store_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          section?: string
          store_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_page_views_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_schedule_overrides: {
        Row: {
          created_at: string
          id: string
          label: string | null
          national_schedule_id: string
          occurrence_date: string
          start_time: string | null
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          national_schedule_id: string
          occurrence_date: string
          start_time?: string | null
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          national_schedule_id?: string
          occurrence_date?: string
          start_time?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_schedule_overrides_national_schedule_id_fkey"
            columns: ["national_schedule_id"]
            isOneToOne: false
            referencedRelation: "store_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_schedule_overrides_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_schedules: {
        Row: {
          created_at: string
          day_of_week: number
          game_id: string
          id: string
          notes: string | null
          start_time: string | null
          store_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          game_id: string
          id?: string
          notes?: string | null
          start_time?: string | null
          store_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          game_id?: string
          id?: string
          notes?: string | null
          start_time?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_schedules_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_schedules_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string | null
          description: string | null
          google_maps_url: string | null
          id: string
          instagram: string | null
          internal_leagues_enabled: boolean
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          opening_hours: string | null
          phone: string | null
          slug: string
          state: string | null
          twitch: string | null
          twitter: string | null
          website: string | null
          zone: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          google_maps_url?: string | null
          id?: string
          instagram?: string | null
          internal_leagues_enabled?: boolean
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          opening_hours?: string | null
          phone?: string | null
          slug: string
          state?: string | null
          twitch?: string | null
          twitter?: string | null
          website?: string | null
          zone?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          google_maps_url?: string | null
          id?: string
          instagram?: string | null
          internal_leagues_enabled?: boolean
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          opening_hours?: string | null
          phone?: string | null
          slug?: string
          state?: string | null
          twitch?: string | null
          twitter?: string | null
          website?: string | null
          zone?: string | null
        }
        Relationships: []
      }
      tournament_results: {
        Row: {
          draws: number
          id: string
          losses: number | null
          match_points: number
          omw_percentage: number
          player_id: string
          points_earned: number | null
          rank: number
          tournament_id: string
          wins: number | null
        }
        Insert: {
          draws?: number
          id?: string
          losses?: number | null
          match_points?: number
          omw_percentage?: number
          player_id: string
          points_earned?: number | null
          rank: number
          tournament_id: string
          wins?: number | null
        }
        Update: {
          draws?: number
          id?: string
          losses?: number | null
          match_points?: number
          omw_percentage?: number
          player_id?: string
          points_earned?: number | null
          rank?: number
          tournament_id?: string
          wins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_results_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_round_results: {
        Row: {
          created_at: string | null
          id: string
          is_auto_populated: boolean
          is_bye: boolean
          notes: string | null
          opponent_leader_id: string | null
          opponent_player_id: string | null
          player_id: string
          player_leader_id: string | null
          reporter_player_id: string
          round_number: number
          source_session_id: string | null
          status: string
          tournament_id: string
          turn_order: string | null
          updated_at: string | null
          won_die_roll: boolean | null
          won_match: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_auto_populated?: boolean
          is_bye?: boolean
          notes?: string | null
          opponent_leader_id?: string | null
          opponent_player_id?: string | null
          player_id: string
          player_leader_id?: string | null
          reporter_player_id: string
          round_number: number
          source_session_id?: string | null
          status?: string
          tournament_id: string
          turn_order?: string | null
          updated_at?: string | null
          won_die_roll?: boolean | null
          won_match?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_auto_populated?: boolean
          is_bye?: boolean
          notes?: string | null
          opponent_leader_id?: string | null
          opponent_player_id?: string | null
          player_id?: string
          player_leader_id?: string | null
          reporter_player_id?: string
          round_number?: number
          source_session_id?: string | null
          status?: string
          tournament_id?: string
          turn_order?: string | null
          updated_at?: string | null
          won_die_roll?: boolean | null
          won_match?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_round_results_opponent_leader_id_fkey"
            columns: ["opponent_leader_id"]
            isOneToOne: false
            referencedRelation: "deck_identifiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_round_results_opponent_player_id_fkey"
            columns: ["opponent_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_round_results_opponent_player_id_fkey"
            columns: ["opponent_player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_round_results_opponent_player_id_fkey"
            columns: ["opponent_player_id"]
            isOneToOne: false
            referencedRelation: "public_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_round_results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_round_results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_round_results_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_round_results_player_leader_id_fkey"
            columns: ["player_leader_id"]
            isOneToOne: false
            referencedRelation: "deck_identifiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_round_results_reporter_player_id_fkey"
            columns: ["reporter_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_round_results_reporter_player_id_fkey"
            columns: ["reporter_player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_round_results_reporter_player_id_fkey"
            columns: ["reporter_player_id"]
            isOneToOne: false
            referencedRelation: "public_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_round_results_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "standalone_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_round_results_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_rsvps: {
        Row: {
          created_at: string | null
          id: string
          player_id: string
          status: string
          tournament_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          player_id: string
          status?: string
          tournament_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          player_id?: string
          status?: string
          tournament_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_rsvps_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_rsvps_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_rsvps_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "public_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_rsvps_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          csv_url: string | null
          game_id: string
          id: string
          league_id: string | null
          published_at: string | null
          qualifying_month: number
          qualifying_semester: number
          qualifying_year: number
          rejection_reason: string | null
          season_id: string | null
          status: Database["public"]["Enums"]["tournament_status"] | null
          store_id: string
          tournament_date: string
          tournament_time: string | null
          undo_deadline: string | null
          unpublish_reason: string | null
          unpublished_at: string | null
          unpublished_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          csv_url?: string | null
          game_id: string
          id?: string
          league_id?: string | null
          published_at?: string | null
          qualifying_month: number
          qualifying_semester: number
          qualifying_year: number
          rejection_reason?: string | null
          season_id?: string | null
          status?: Database["public"]["Enums"]["tournament_status"] | null
          store_id: string
          tournament_date: string
          tournament_time?: string | null
          undo_deadline?: string | null
          unpublish_reason?: string | null
          unpublished_at?: string | null
          unpublished_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          csv_url?: string | null
          game_id?: string
          id?: string
          league_id?: string | null
          published_at?: string | null
          qualifying_month?: number
          qualifying_semester?: number
          qualifying_year?: number
          rejection_reason?: string | null
          season_id?: string | null
          status?: Database["public"]["Enums"]["tournament_status"] | null
          store_id?: string
          tournament_date?: string
          tournament_time?: string | null
          undo_deadline?: string | null
          unpublish_reason?: string | null
          unpublished_at?: string | null
          unpublished_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "public_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "store_leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_unpublished_by_fkey"
            columns: ["unpublished_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_unpublished_by_fkey"
            columns: ["unpublished_by"]
            isOneToOne: false
            referencedRelation: "players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_unpublished_by_fkey"
            columns: ["unpublished_by"]
            isOneToOne: false
            referencedRelation: "public_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      players_public: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          geek_tag: string | null
          home_store_id: string | null
          id: string | null
          is_active: boolean | null
          role: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          geek_tag?: string | null
          home_store_id?: string | null
          id?: string | null
          is_active?: boolean | null
          role?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          geek_tag?: string | null
          home_store_id?: string | null
          id?: string | null
          is_active?: boolean | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_home_store_id_fkey"
            columns: ["home_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      public_players_view: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          geek_tag: string | null
          id: string | null
          is_active: boolean | null
          role: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          geek_tag?: string | null
          id?: string | null
          is_active?: boolean | null
          role?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          geek_tag?: string | null
          id?: string | null
          is_active?: boolean | null
          role?: string | null
        }
        Relationships: []
      }
      sponsor_metrics_current_month: {
        Row: {
          cycles_count: number | null
          display_order: number | null
          id: string | null
          is_active: boolean | null
          name: string | null
          pct_consumed: number | null
          view_limit: number | null
          views_this_month: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_vault_secret: { Args: { secret_name: string }; Returns: string }
      increment_sponsor_view: {
        Args: { p_sponsor_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      timeframe_type:
        | "MONTH"
        | "SEMESTER"
        | "YEAR"
        | "ALL_TIME"
        | "MONTHLY"
        | "SEMESTRAL"
      tournament_status:
        | "DRAFT"
        | "PENDING_APPROVAL"
        | "APPROVED"
        | "PUBLISHED"
        | "CANCELLED"
        | "UNPUBLISHED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      timeframe_type: [
        "MONTH",
        "SEMESTER",
        "YEAR",
        "ALL_TIME",
        "MONTHLY",
        "SEMESTRAL",
      ],
      tournament_status: [
        "DRAFT",
        "PENDING_APPROVAL",
        "APPROVED",
        "PUBLISHED",
        "CANCELLED",
        "UNPUBLISHED",
      ],
    },
  },
} as const

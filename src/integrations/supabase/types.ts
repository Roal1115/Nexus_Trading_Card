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
          player_id: string
          rank_position: number | null
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
          player_id: string
          rank_position?: number | null
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
          player_id?: string
          rank_position?: number | null
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
            foreignKeyName: "leaderboard_snapshots_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          geek_tag: string
          home_store_id: string | null
          id: string
          is_active: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          geek_tag: string
          home_store_id?: string | null
          id?: string
          is_active?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          geek_tag?: string
          home_store_id?: string | null
          id?: string
          is_active?: boolean | null
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
      stores: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          state: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          state?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          state?: string | null
        }
        Relationships: []
      }
      tournament_results: {
        Row: {
          id: string
          losses: number | null
          player_id: string
          points_earned: number | null
          rank: number
          tournament_id: string
          wins: number | null
        }
        Insert: {
          id?: string
          losses?: number | null
          player_id: string
          points_earned?: number | null
          rank: number
          tournament_id: string
          wins?: number | null
        }
        Update: {
          id?: string
          losses?: number | null
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
            foreignKeyName: "tournament_results_tournament_id_fkey"
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
          created_at: string | null
          csv_url: string | null
          game_id: string
          id: string
          published_at: string | null
          qualifying_month: number
          qualifying_semester: number
          qualifying_year: number
          status: Database["public"]["Enums"]["tournament_status"] | null
          store_id: string
          tournament_date: string
          undo_deadline: string | null
        }
        Insert: {
          approved_at?: string | null
          created_at?: string | null
          csv_url?: string | null
          game_id: string
          id?: string
          published_at?: string | null
          qualifying_month: number
          qualifying_semester: number
          qualifying_year: number
          status?: Database["public"]["Enums"]["tournament_status"] | null
          store_id: string
          tournament_date: string
          undo_deadline?: string | null
        }
        Update: {
          approved_at?: string | null
          created_at?: string | null
          csv_url?: string | null
          game_id?: string
          id?: string
          published_at?: string | null
          qualifying_month?: number
          qualifying_semester?: number
          qualifying_year?: number
          status?: Database["public"]["Enums"]["tournament_status"] | null
          store_id?: string
          tournament_date?: string
          undo_deadline?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      timeframe_type: "MONTHLY" | "SEMESTRAL"
      tournament_status: "DRAFT" | "APPROVED" | "PUBLISHED"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      timeframe_type: ["MONTHLY", "SEMESTRAL"],
      tournament_status: ["DRAFT", "APPROVED", "PUBLISHED"],
    },
  },
} as const

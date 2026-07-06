// GeekArena Supabase client
// This project is bound to a Lovable Cloud backend, so the auto-generated
// client in src/integrations/supabase/* cannot be repointed. Instead we
// expose a second client here that talks to the user's own GeekArena
// Supabase project. Publishable (anon) keys are safe to ship in code.

import { createClient } from "@supabase/supabase-js";

const GEEKARENA_URL = "https://tbtyxtigbsljyrwyelqr.supabase.co";
const GEEKARENA_PUBLISHABLE_KEY = "sb_publishable_Td7bOB5_MLT1Y5MHbO35qw_y-jeLHCw";

const isBrowser = typeof window !== "undefined";

export const geekarena = createClient(GEEKARENA_URL, GEEKARENA_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "geekarena.auth",
    storage: isBrowser
      ? window.localStorage
      : {
          // Stub para SSR — nunca persiste en servidor
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        },
  },
});

// ---------- Lightweight row types (hand-written; expand as needed) ----------
export type Store = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  is_active: boolean | null;
};

export type Game = {
  id: string;
  slug: string;
  name: string;
  publisher: string | null;
  logo_url: string | null;
  is_active: boolean | null;
};

export type Player = {
  id: string;
  geek_tag: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  home_store_id: string | null;
  is_active: boolean | null;
};

export type LeaderboardSnapshot = {
  id: string;
  player_id: string;
  game_id: string;
  store_id: string | null;
  timeframe_type: "MONTH" | "SEMESTER" | "YEAR" | "ALL_TIME";
  timeframe_value: string;
  total_points: number | null;
  tournaments_played: number | null;
  tournaments_won: number | null;
  rank_position: number | null;
  last_updated_at: string | null;
};

// Server-only admin client for the GeekArena Supabase project.
// Uses the service role key (NEVER ship to client).
import { createClient } from "@supabase/supabase-js";

const GEEKARENA_URL = "https://tbtyxtigbsljyrwyelqr.supabase.co";

export function getGeekarenaAdmin() {
  const key = process.env.GEEKARENA_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "GEEKARENA_SERVICE_ROLE_KEY no está configurada en el server.",
    );
  }
  return createClient(GEEKARENA_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

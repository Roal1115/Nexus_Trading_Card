// Server-only admin client for the GeekArena Supabase project.
// Uses the service role key (NEVER ship to client).
import { createClient } from "@supabase/supabase-js";

const GEEKARENA_URL = "https://tbtyxtigbsljyrwyelqr.supabase.co";

// Loggea el error real de Postgres/Supabase en el servidor y lanza un
// mensaje genérico al cliente — los mensajes de PostgREST filtran nombres
// de tablas, columnas y constraints (AUDIT.md 1.6).
export function failDb(error: { message?: string } | null | undefined): never {
  console.error("[db]", error?.message ?? error);
  throw new Error("Error al procesar la solicitud. Intenta de nuevo.");
}

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

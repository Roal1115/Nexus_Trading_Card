// Server-only admin client for the Nexus Supabase project.
// Uses the service role key (NEVER ship to client).
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Producción por default; NEXUS_URL (o VITE_NEXUS_URL) apunta a un Branch.
const NEXUS_URL =
  process.env.NEXUS_URL ||
  import.meta.env?.VITE_NEXUS_URL ||
  "https://tbtyxtigbsljyrwyelqr.supabase.co";

// Loggea el error real de Postgres/Supabase en el servidor y lanza un
// mensaje genérico al cliente — los mensajes de PostgREST filtran nombres
// de tablas, columnas y constraints (AUDIT.md 1.6).
export function failDb(error: { message?: string } | null | undefined): never {
  console.error("[db]", error?.message ?? error);
  throw new Error("Error al procesar la solicitud. Intenta de nuevo.");
}

// Contraseña temporal para cuentas creadas por un admin. crypto.getRandomValues
// existe en Workers y Node. 24 chars de un alfabeto de 56 ≈ 139 bits; el sufijo
// fijo garantiza mayúscula, minúscula, dígito y símbolo.
export function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  // Rechazo para evitar sesgo de módulo: solo bytes por debajo del mayor múltiplo del alfabeto.
  const limit = 256 - (256 % alphabet.length);
  let out = "";
  while (out.length < 24) {
    for (const b of crypto.getRandomValues(new Uint8Array(32))) {
      if (b < limit && out.length < 24) out += alphabet[b % alphabet.length];
    }
  }
  return `${out}Aa1!`;
}

// Al asignar un organizer a una tienda, desliga a los OTROS organizers de esa
// tienda (una tienda, un organizer). Solo toca role = 'organizer': los jugadores
// comunes, tcg_managers y admins conservan su home_store_id.
export async function clearOtherStoreOrganizers(
  admin: ReturnType<typeof getNexusAdmin>,
  storeId: string,
  keepPlayerId: string,
) {
  return admin
    .from("players")
    .update({ home_store_id: null })
    .eq("home_store_id", storeId)
    .eq("role", "organizer")
    .neq("id", keepPlayerId);
}

export function getNexusAdmin() {
  const key = process.env.NEXUS_SERVICE_ROLE_KEY ?? process.env.GEEKARENA_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "NEXUS_SERVICE_ROLE_KEY / GEEKARENA_SERVICE_ROLE_KEY no está configurada en el server.",
    );
  }
  return createClient<Database>(NEXUS_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

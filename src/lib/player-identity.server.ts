// Resolución de identidad de jugadores en la carga de torneos.
// Sin dependencias de TanStack: se prueba directo con scripts/identity.check.mts.
import { failDb, type getNexusAdmin } from "./nexus-admin.server";
import { normalizeTcgId } from "./utils";

type Admin = ReturnType<typeof getNexusAdmin>;

export const ONE_PIECE_SLUG = "one-piece";

async function findTcgHolder(
  admin: Admin,
  gameId: string,
  normalized: string,
): Promise<string | null> {
  // UNIQUE (game_id, tcg_user_id_normalized) garantiza 0 o 1 fila.
  const { data, error } = await admin
    .from("player_tcg_ids")
    .select("player_id")
    .eq("game_id", gameId)
    .eq("tcg_user_id_normalized", normalized)
    .maybeSingle();
  if (error) failDb(error);
  return (data?.player_id as string | undefined) ?? null;
}

// Crea un placeholder con el primer geek_tag libre de `tags` (geek_tag es UNIQUE).
async function insertPlaceholder(admin: Admin, tags: string[]): Promise<string> {
  for (const tag of tags) {
    const { data, error } = await admin
      .from("players")
      .insert({ geek_tag: tag, is_active: true, role: "player" })
      .select("id")
      .single();
    if (!error) return data.id as string;
    if (error.code !== "23505") failDb(error);
  }
  throw new Error(`No se pudo crear el jugador: ${tags[0]}`);
}

// Identidad canónica = Bandai/TCG ID. Con ID, el nombre del CSV nunca decide a quién
// pertenece el resultado; solo se usa como geek_tag inicial del placeholder.
export async function resolvePlayer(
  admin: Admin,
  nexusTag: string,
  membershipId: string | null,
  gameId: string,
  guestWithoutId: boolean, // true para One Piece: sin Bandai ID = invitado
): Promise<{ id: string; isNew: boolean }> {
  if (membershipId) {
    const normalized = normalizeTcgId(membershipId);
    const holder = await findTcgHolder(admin, gameId, normalized);
    if (holder) return { id: holder, isNew: false };

    const id = await insertPlaceholder(admin, [nexusTag, `${nexusTag} #${normalized}`]);
    const { error } = await admin
      .from("player_tcg_ids")
      .insert({
        player_id: id,
        game_id: gameId,
        tcg_user_id: membershipId,
        tcg_user_id_normalized: normalized,
      });
    if (!error) return { id, isNew: true };

    // Otro upload registró este ID en paralelo: el UNIQUE decide, usamos el suyo.
    await admin.from("players").delete().eq("id", id);
    const winner = error.code === "23505" ? await findTcgHolder(admin, gameId, normalized) : null;
    if (!winner) failDb(error);
    return { id: winner, isNew: false };
  }

  // One Piece sin Bandai ID: no hay identidad, nunca se identifica por nombre.
  // Cada fila es un invitado nuevo (reclamar invitados queda fuera de alcance).
  if (guestWithoutId) {
    const tag = `${nexusTag} (invitado ${crypto.randomUUID().slice(0, 8)})`;
    return { id: await insertPlaceholder(admin, [tag]), isNew: true };
  }

  // Otros juegos sin ID: match por nombre de siempre (sin cambios).
  const { data: byTag, error } = await admin
    .from("players")
    .select("id")
    .eq("geek_tag", nexusTag)
    .maybeSingle();
  if (error) failDb(error);
  if (byTag) return { id: byTag.id as string, isNew: false };
  return { id: await insertPlaceholder(admin, [nexusTag]), isNew: true };
}

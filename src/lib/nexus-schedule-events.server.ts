// Cancelaciones por fecha de los horarios proyectados.
import { failDb, getNexusAdmin } from "./nexus-admin.server";

type Admin = ReturnType<typeof getNexusAdmin>;

export const occurrenceKey = (
  storeId: string,
  gameId: string,
  leagueId: string | null | undefined,
  date: string,
) => `${storeId}_${gameId}_${leagueId ?? "national"}_${date}`;

/** Motivo de cada fecha cancelada en el rango, por occurrenceKey. */
export async function loadCancellations(
  admin: Admin,
  storeIds: string[],
  from: string,
  to: string,
): Promise<Map<string, string>> {
  if (storeIds.length === 0) return new Map();
  const { data, error } = await (admin as any)
    .from("schedule_cancellations")
    .select("store_id, game_id, league_id, occurrence_date, reason")
    .in("store_id", storeIds)
    .gte("occurrence_date", from)
    .lte("occurrence_date", to);
  if (error) failDb(error);
  return new Map(
    (data ?? []).map((c: any) => [
      occurrenceKey(c.store_id, c.game_id, c.league_id, c.occurrence_date),
      c.reason as string,
    ]),
  );
}

// Tabla General y Tabla Mensual de todo el circuito. Se calculan desde los
// resultados y no sumando leaderboard_snapshots, porque cada snapshot aplica el
// tope de 2 por semana dentro de una sola tienda.
import { failDb, getNexusAdmin } from "./nexus-admin.server";
import { standingsOf, type Standing } from "./playoffs";

type Admin = ReturnType<typeof getNexusAdmin>;

export type RankingRow = {
  player_id: string;
  rank: number | null;
  points_earned: number | null;
  omw_percentage: number | null;
  tournaments: { store_id: string; tournament_date: string };
};

export type RankingEntry = Standing & { won: number; storeIds: Set<string> };

const CACHE_TTL = 3 * 60 * 1000;
const PAGE_SIZE = 1000;
const cache = new Map<string, { rows: RankingRow[]; ts: number }>();

async function fetchRows(
  admin: Admin,
  gameId: string,
  scope: { seasonId: string } | { year: number; month: number },
): Promise<RankingRow[]> {
  const key = JSON.stringify([gameId, scope]);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.rows;

  const rows: RankingRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = admin
      .from("tournament_results")
      .select(
        "id, player_id, rank, points_earned, omw_percentage, tournaments!inner(store_id, tournament_date, status, game_id, league_id, season_id, qualifying_year, qualifying_month)",
      )
      .eq("tournaments.status", "PUBLISHED")
      .eq("tournaments.game_id", gameId)
      .is("tournaments.league_id", null);
    query =
      "seasonId" in scope
        ? query.eq("tournaments.season_id", scope.seasonId)
        : query
            .eq("tournaments.qualifying_year", scope.year)
            .eq("tournaments.qualifying_month", scope.month);
    const { data, error } = await query.order("id").range(from, from + PAGE_SIZE - 1);
    if (error) failDb(error);
    rows.push(...((data ?? []) as unknown as RankingRow[]));
    if ((data ?? []).length < PAGE_SIZE) break;
  }
  cache.set(key, { rows, ts: Date.now() });
  return rows;
}

export const seasonRows = (admin: Admin, gameId: string, seasonId: string) =>
  fetchRows(admin, gameId, { seasonId });

/** Resultados de un mes YYYY-MM. */
export function monthRows(admin: Admin, gameId: string, monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return fetchRows(admin, gameId, { year, month });
}

/** Tabla ordenada con el tope de 2 por semana sobre todas las filas recibidas. */
export function tableOf(rows: RankingRow[]): RankingEntry[] {
  const extras = new Map<string, { won: number; storeIds: Set<string> }>();
  for (const row of rows) {
    const extra = extras.get(row.player_id) ?? { won: 0, storeIds: new Set<string>() };
    if (row.rank === 1) extra.won += 1;
    extra.storeIds.add(row.tournaments.store_id);
    extras.set(row.player_id, extra);
  }
  return standingsOf(
    rows.map((row) => ({
      playerId: row.player_id,
      subregion: "",
      date: row.tournaments.tournament_date,
      month: "",
      points: row.points_earned ?? 0,
      omw: Number(row.omw_percentage ?? 0),
    })),
  ).map((standing) => ({
    ...standing,
    omw: Math.round(standing.omw * 100) / 100,
    ...extras.get(standing.playerId)!,
  }));
}

/** Puntos y posición de un jugador; posición 0 si no aparece. */
export function entryOf(table: RankingEntry[], playerId: string) {
  const index = table.findIndex((entry) => entry.playerId === playerId);
  const entry = table[index];
  return {
    total_points: entry?.points ?? 0,
    rank_position: index + 1,
    tournaments_played: entry?.played ?? 0,
    tournaments_won: entry?.won ?? 0,
  };
}

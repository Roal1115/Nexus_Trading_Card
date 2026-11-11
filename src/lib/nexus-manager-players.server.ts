import { failDb } from "./nexus-admin.server";
import { statusAcrossStores } from "./player-status";
import { todayInMexicoStr } from "./utils";

// Jugadores de un TCG con su estado, para los paneles de varias tiendas.
export async function loadGamePlayers(admin: any, gameId: string, storeIds?: string[]) {
  const scope = ["APPROVED", "PUBLISHED"];
  let tournamentsQuery = admin
    .from("tournaments")
    .select("store_id, tournament_date")
    .eq("game_id", gameId)
    .in("status", scope)
    .is("league_id", null);
  if (storeIds) tournamentsQuery = tournamentsQuery.in("store_id", storeIds);
  const { data: tournaments, error } = await tournamentsQuery;
  if (error) failDb(error);

  // PostgREST corta en 1000 filas: sin paginar, el conteo quedaría mal en silencio.
  const results: any[] = [];
  for (let from = 0; ; from += 1000) {
    let q = admin
      .from("tournament_results")
      .select(
        "id, player_id, points_earned, players!inner(geek_tag), tournaments!inner(store_id, tournament_date, game_id, status, league_id)",
      )
      .eq("tournaments.game_id", gameId)
      .in("tournaments.status", scope)
      .is("tournaments.league_id", null)
      .order("id")
      .range(from, from + 999);
    if (storeIds) q = q.in("tournaments.store_id", storeIds);
    const { data, error: resultsError } = await q;
    if (resultsError) failDb(resultsError);
    results.push(...data);
    if (data.length < 1000) break;
  }

  const byPlayer = new Map<
    string,
    { geek_tag: string; points: number; visits: Array<{ store_id: string; date: string }> }
  >();
  for (const r of results) {
    const entry = byPlayer.get(r.player_id) ?? {
      geek_tag: r.players.geek_tag,
      points: 0,
      visits: [] as Array<{ store_id: string; date: string }>,
    };
    entry.points += r.points_earned ?? 0;
    entry.visits.push({ store_id: r.tournaments.store_id, date: r.tournaments.tournament_date });
    byPlayer.set(r.player_id, entry);
  }

  const held = (tournaments ?? []).map((t: any) => ({
    store_id: t.store_id,
    date: t.tournament_date,
  }));
  const today = todayInMexicoStr();
  return Array.from(byPlayer.entries())
    .map(([player_id, p]) => {
      const { status, missed } = statusAcrossStores(p.visits, held, today);
      const lastVisit = p.visits.reduce((a, v) => (v.date > a ? v.date : a), "");
      return {
        player_id,
        geek_tag: p.geek_tag,
        tournaments_in_range: p.visits.length,
        points: Math.round(p.points),
        status,
        missed_tournaments: missed,
        last_visit: lastVisit,
        days_since: Math.round((Date.parse(today) - Date.parse(lastVisit)) / 86_400_000),
      };
    })
    .sort((a, b) => b.last_visit.localeCompare(a.last_visit));
}

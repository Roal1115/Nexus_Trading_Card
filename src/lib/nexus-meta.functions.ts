// Meta público de México: win rates y matchups por líder, solo con rondas de
// torneos oficiales publicados (las Sessions vinculadas ya viven ahí).
// Endpoints públicos: solo exponen agregados anónimos, nunca rondas crudas.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getNexusAdmin } from "./nexus-admin.server";

const MIN_ROUNDS = 5;

/**
 * Un error de Supabase no es "sin datos": si se tragara, el meta público mostraría
 * "Sin datos suficientes" ante una falla y el jugador no sabría que debe reintentar.
 */
function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) {
    console.error(`[meta] ${what}:`, res.error.message);
    throw new Error("No pudimos cargar el meta");
  }
  return (res.data ?? []) as T;
}
const MIN_MATCHUP_ROUNDS = 3;

const filtersSchema = z.object({
  game_id: z.string().uuid(),
  season_id: z.string().uuid().nullable().optional(),
  zone: z.string().nullable().optional(),
  store_id: z.string().uuid().nullable().optional(),
  date_from: z.string().nullable().optional(),
  date_to: z.string().nullable().optional(),
});
type MetaFilters = z.infer<typeof filtersSchema>;

type Round = {
  tournament_id: string;
  round_number: number;
  player_id: string;
  opponent_player_id: string | null;
  player_leader_id: string | null;
  opponent_leader_id: string | null;
  won_match: boolean | null;
  turn_order: string | null;
};

// ponytail: .in() con cientos de UUIDs arma una URL que puede pasar el
// límite de headers de undici (16KB, ver fix en getMyCasualStats /
// getStandaloneSessions) — se trocea antes de mandarla.
const ID_BATCH_SIZE = 150;

/**
 * PostgREST corta cada respuesta en 1,000 filas sin avisar: sin paginar, el meta se
 * calculaba con 1,000 de ~9,600 rondas. Pide páginas (con orden estable) hasta una corta.
 */
const PAGE_SIZE = 1000;
async function fetchAllPages<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  what: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const rows = must(await page(from, from + PAGE_SIZE - 1), what) as T[];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) return out;
  }
}

async function fetchTournamentRounds(
  admin: ReturnType<typeof getNexusAdmin>,
  ids: string[],
): Promise<Round[]> {
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += ID_BATCH_SIZE) batches.push(ids.slice(i, i + ID_BATCH_SIZE));

  const results = await Promise.all(
    batches.map((batch) =>
      fetchAllPages<Round>(
        (from, to) =>
          admin
            .from("tournament_round_results")
            .select(
              "tournament_id, round_number, player_id, opponent_player_id, player_leader_id, opponent_leader_id, won_match, turn_order",
            )
            .in("tournament_id", batch)
            .eq("is_bye", false)
            .not("won_match", "is", null)
            .order("id")
            .range(from, to) as any,
        "rondas de torneo",
      ),
    ),
  );
  return results.flat();
}

async function fetchMetaRounds(
  admin: ReturnType<typeof getNexusAdmin>,
  data: MetaFilters,
): Promise<{ rounds: Round[]; tournamentIds: string[] }> {
  // Rondas de torneos publicados. El builder se arma de nuevo por página: es mutable y
  // reusarlo acumularía el order y el range de la página anterior.
  const tournamentPage = (from: number, to: number) => {
    let q = admin
      .from("tournaments")
      .select("id, stores!inner(zone)")
      .eq("game_id", data.game_id)
      .eq("status", "PUBLISHED");
    if (data.date_from) q = q.gte("tournament_date", data.date_from);
    if (data.date_to) q = q.lte("tournament_date", data.date_to);
    if (data.store_id) q = q.eq("store_id", data.store_id);
    if (data.zone) q = q.eq("stores.zone", data.zone);
    return q.order("id").range(from, to) as any;
  };
  const tournaments = await fetchAllPages<{ id: string }>(tournamentPage, "torneos publicados");
  const tournamentIds = tournaments.map((t) => t.id);

  // Solo torneos oficiales: esta función es pública, y las partidas casuales son
  // personales y sin verificar. Las vinculadas ya entran como rondas del torneo.
  const rounds = await fetchTournamentRounds(admin, tournamentIds);
  return { rounds, tournamentIds };
}

async function fetchInBatches<T>(
  ids: string[],
  fetcher: (
    batch: string[],
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += ID_BATCH_SIZE) batches.push(ids.slice(i, i + ID_BATCH_SIZE));
  const results = await Promise.all(
    batches.map((batch) =>
      fetchAllPages<T>((from, to) => fetcher(batch, from, to), "lote de resultados"),
    ),
  );
  return results.flat();
}

// Torneos ganados (rank=1) por líder canónico — el campeón de un torneo pudo
// jugar variantes de arte distintas ronda a ronda, así que se toma el leader
// más usado por ese jugador en ese torneo específico.
async function computeTournamentWinsByLeader(
  admin: ReturnType<typeof getNexusAdmin>,
  tournamentIds: string[],
  resolve: (id: string) => string,
): Promise<Map<string, number>> {
  if (tournamentIds.length === 0) return new Map();

  const champions = await fetchInBatches<{ tournament_id: string; player_id: string }>(
    tournamentIds,
    (batch, from, to) =>
      admin
        .from("tournament_results")
        .select("tournament_id, player_id")
        .in("tournament_id", batch)
        .eq("rank", 1)
        .order("id")
        .range(from, to) as any,
  );
  if (champions.length === 0) return new Map();

  const wonTournamentIds = Array.from(new Set(champions.map((c) => c.tournament_id)));
  const champRounds = await fetchInBatches<{
    tournament_id: string;
    player_id: string;
    player_leader_id: string;
  }>(
    wonTournamentIds,
    (batch, from, to) =>
      admin
        .from("tournament_round_results")
        .select("tournament_id, player_id, player_leader_id")
        .in("tournament_id", batch)
        .eq("is_bye", false)
        .not("player_leader_id", "is", null)
        .order("id")
        .range(from, to) as any,
  );

  const leaderCountsByTournamentPlayer = new Map<string, Map<string, number>>();
  for (const r of champRounds) {
    const key = `${r.tournament_id}|${r.player_id}`;
    const counts = leaderCountsByTournamentPlayer.get(key) ?? new Map<string, number>();
    const canonicalId = resolve(r.player_leader_id);
    counts.set(canonicalId, (counts.get(canonicalId) ?? 0) + 1);
    leaderCountsByTournamentPlayer.set(key, counts);
  }

  const winsByLeader = new Map<string, number>();
  for (const c of champions) {
    const counts = leaderCountsByTournamentPlayer.get(`${c.tournament_id}|${c.player_id}`);
    if (!counts || counts.size === 0) continue;
    const topLeaderId = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
    winsByLeader.set(topLeaderId, (winsByLeader.get(topLeaderId) ?? 0) + 1);
  }
  return winsByLeader;
}

// Resuelve arte alternativo → líder canónico y regresa info de cada líder
export async function resolveLeaders(admin: ReturnType<typeof getNexusAdmin>, ids: string[]) {
  const rawLeaders = ids.length
    ? (must(
        await admin
          .from("deck_identifiers")
          .select("id, base_name, card_image, card_set_id, colors, canonical_leader_id")
          .in("id", ids),
        "líderes",
      ) as any[])
    : [];

  const variantToCanonical = new Map<string, string>();
  for (const l of rawLeaders ?? []) {
    if (l.canonical_leader_id) variantToCanonical.set(l.id, l.canonical_leader_id);
  }

  const missingCanonicalIds = Array.from(new Set(Array.from(variantToCanonical.values()))).filter(
    (id) => !(rawLeaders ?? []).find((l: any) => l.id === id),
  );
  const canonicalLeaders = missingCanonicalIds.length
    ? (must(
        await admin
          .from("deck_identifiers")
          .select("id, base_name, card_image, card_set_id, colors, canonical_leader_id")
          .in("id", missingCanonicalIds),
        "líderes canónicos",
      ) as any[])
    : [];

  const info = new Map(
    [...(rawLeaders ?? []), ...(canonicalLeaders ?? [])].map((l: any) => [l.id, l]),
  );
  const resolve = (id: string) => variantToCanonical.get(id) ?? id;
  return { info, resolve };
}

export const getMetaStats = createServerFn({ method: "POST" })
  .inputValidator((d: MetaFilters) => filtersSchema.parse(d))
  .handler(async ({ data }) => {
    const admin = getNexusAdmin();
    const { rounds: allRounds, tournamentIds } = await fetchMetaRounds(admin, data);
    const totalRounds = allRounds.length;

    const leaderMap = new Map<
      string,
      {
        total: number;
        wins: number;
        first: number;
        firstWins: number;
        second: number;
        secondWins: number;
      }
    >();

    for (const r of allRounds) {
      if (!r.player_leader_id) continue;
      const entry = leaderMap.get(r.player_leader_id) ?? {
        total: 0,
        wins: 0,
        first: 0,
        firstWins: 0,
        second: 0,
        secondWins: 0,
      };
      entry.total++;
      if (r.won_match) entry.wins++;
      if (r.turn_order === "first") {
        entry.first++;
        if (r.won_match) entry.firstWins++;
      }
      if (r.turn_order === "second") {
        entry.second++;
        if (r.won_match) entry.secondWins++;
      }
      leaderMap.set(r.player_leader_id, entry);
    }

    const { info, resolve } = await resolveLeaders(admin, Array.from(leaderMap.keys()));

    // Consolidar por canónico
    const canonicalMap = new Map<string, NonNullable<ReturnType<(typeof leaderMap)["get"]>>>();
    for (const [id, stats] of leaderMap.entries()) {
      const canonicalId = resolve(id);
      const existing = canonicalMap.get(canonicalId);
      if (existing) {
        existing.total += stats.total;
        existing.wins += stats.wins;
        existing.first += stats.first;
        existing.firstWins += stats.firstWins;
        existing.second += stats.second;
        existing.secondWins += stats.secondWins;
      } else {
        canonicalMap.set(canonicalId, { ...stats });
      }
    }

    const winsByLeader = await computeTournamentWinsByLeader(admin, tournamentIds, resolve);

    const leaders = Array.from(canonicalMap.entries())
      .filter(([, v]) => v.total >= MIN_ROUNDS)
      .map(([canonicalId, stats]) => {
        const leader = info.get(canonicalId);
        return {
          leader_id: canonicalId,
          leader_name: leader?.base_name ?? "Desconocido",
          leader_image: leader?.card_image ?? null,
          card_set_id: leader?.card_set_id ?? null,
          colors: (leader?.colors ?? []) as string[],
          total_rounds: stats.total,
          wins: stats.wins,
          win_rate: stats.total > 0 ? Math.round((stats.wins / stats.total) * 1000) / 10 : 0,
          play_rate: totalRounds > 0 ? Math.round((stats.total / totalRounds) * 1000) / 10 : 0,
          first_win_rate:
            stats.first > 0 ? Math.round((stats.firstWins / stats.first) * 1000) / 10 : null,
          second_win_rate:
            stats.second > 0 ? Math.round((stats.secondWins / stats.second) * 1000) / 10 : null,
          first_rounds: stats.first,
          second_rounds: stats.second,
          tournaments_won: winsByLeader.get(canonicalId) ?? 0,
        };
      })
      .sort((a, b) => b.play_rate - a.play_rate);

    return { leaders, total_rounds: totalRounds, filters: data };
  });

export const getMetaMatchups = createServerFn({ method: "POST" })
  .inputValidator((d: MetaFilters) => filtersSchema.parse(d))
  .handler(async ({ data }) => {
    const admin = getNexusAdmin();
    const { rounds: allRounds } = await fetchMetaRounds(admin, data);

    const ids = new Set<string>();
    for (const r of allRounds) {
      if (r.player_leader_id) ids.add(r.player_leader_id);
      if (r.opponent_leader_id) ids.add(r.opponent_leader_id);
    }
    const { info, resolve } = await resolveLeaders(admin, Array.from(ids));

    // Celda a|b = rondas de a contra b (desde la perspectiva de a)
    type Cell = {
      wins: number;
      total: number;
      firstWins: number;
      first: number;
      secondWins: number;
      second: number;
    };
    const emptyCell = (): Cell => ({
      wins: 0,
      total: 0,
      firstWins: 0,
      first: 0,
      secondWins: 0,
      second: 0,
    });
    const cells = new Map<string, Cell>();
    const totals = new Map<string, number>();
    // Cada partida suele estar dos veces: la fila de cada jugador. Sumar la fila (a|b) y además
    // su espejo (b|a) contaba cada partida doble. El espejo solo se suma cuando el rival NO
    // registró su propia fila (reporte de un solo lado).
    const rowKeys = new Set(
      allRounds.map(
        (r) => `${r.tournament_id}|${r.round_number}|${r.player_id}|${r.opponent_player_id}`,
      ),
    );
    const hasRivalRow = (r: Round) =>
      !!r.opponent_player_id &&
      rowKeys.has(`${r.tournament_id}|${r.round_number}|${r.opponent_player_id}|${r.player_id}`);
    for (const r of allRounds) {
      if (!r.player_leader_id || !r.opponent_leader_id || r.won_match === null) continue;
      const a = resolve(r.player_leader_id);
      const b = resolve(r.opponent_leader_id);
      const key = `${a}|${b}`;
      const cell = cells.get(key) ?? emptyCell();
      cell.total++;
      if (r.won_match) cell.wins++;
      if (r.turn_order === "first") {
        cell.first++;
        if (r.won_match) cell.firstWins++;
      } else if (r.turn_order === "second") {
        cell.second++;
        if (r.won_match) cell.secondWins++;
      }
      cells.set(key, cell);
      totals.set(a, (totals.get(a) ?? 0) + 1);
      if (hasRivalRow(r)) continue;
      // Sin la fila del rival, su perspectiva se deduce de esta: el matchup inverso
      // (si a jugó primero, b jugó segundo en esa misma ronda, y viceversa).
      const invKey = `${b}|${a}`;
      const inv = cells.get(invKey) ?? emptyCell();
      inv.total++;
      if (!r.won_match) inv.wins++;
      if (r.turn_order === "first") {
        inv.second++;
        if (!r.won_match) inv.secondWins++;
      } else if (r.turn_order === "second") {
        inv.first++;
        if (!r.won_match) inv.firstWins++;
      }
      cells.set(invKey, inv);
      totals.set(b, (totals.get(b) ?? 0) + 1);
    }

    const leaders = Array.from(totals.entries())
      .filter(([, total]) => total >= MIN_ROUNDS)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => {
        const l = info.get(id);
        return {
          leader_id: id,
          leader_name: l?.base_name ?? "Desconocido",
          leader_image: l?.card_image ?? null,
          card_set_id: l?.card_set_id ?? null,
          colors: (l?.colors ?? []) as string[],
        };
      });

    const matchups: Record<
      string,
      {
        wins: number;
        total: number;
        win_rate: number;
        first_total: number;
        first_win_rate: number | null;
        second_total: number;
        second_win_rate: number | null;
      }
    > = {};
    // Todo par de líderes elegibles (mismo umbral que el leaderboard, no solo el
    // Top 10 de la matriz) queda disponible — el explorador de cualquier líder
    // lee de esta misma respuesta sin una query aparte.
    const eligibleIds = new Set(
      Array.from(totals.entries())
        .filter(([, total]) => total >= MIN_ROUNDS)
        .map(([id]) => id),
    );
    for (const [key, cell] of cells.entries()) {
      if (cell.total < MIN_MATCHUP_ROUNDS) continue;
      const [a, b] = key.split("|");
      if (a === b || !eligibleIds.has(a) || !eligibleIds.has(b)) continue;
      matchups[key] = {
        wins: cell.wins,
        total: cell.total,
        win_rate: Math.round((cell.wins / cell.total) * 1000) / 10,
        first_total: cell.first,
        first_win_rate:
          cell.first > 0 ? Math.round((cell.firstWins / cell.first) * 1000) / 10 : null,
        second_total: cell.second,
        second_win_rate:
          cell.second > 0 ? Math.round((cell.secondWins / cell.second) * 1000) / 10 : null,
      };
    }

    return { leaders, matchups };
  });

export const getMetaFilterOptions = createServerFn({ method: "POST" })
  .inputValidator((d: { game_id: string }) => z.object({ game_id: z.string().uuid() }).parse(d))
  .handler(async () => {
    const admin = getNexusAdmin();

    const [gamesRes, storesRes, zonesRes, seasonsRes] = await Promise.all([
      admin.from("games").select("id, name, slug").eq("is_active", true).order("name"),
      admin.from("stores").select("id, name, city, zone").eq("is_active", true).order("name"),
      admin.from("stores").select("zone").eq("is_active", true),
      admin
        .from("seasons")
        .select("id, name, slug, start_date, end_date, is_active")
        .order("created_at", { ascending: false }),
    ]);

    const uniqueZones = Array.from(
      new Set(((zonesRes.data ?? []) as any[]).map((s: any) => s.zone).filter(Boolean)),
    ).sort();

    return {
      games: gamesRes.data ?? [],
      stores: storesRes.data ?? [],
      zones: uniqueZones,
      seasons: seasonsRes.data ?? [],
    };
  });

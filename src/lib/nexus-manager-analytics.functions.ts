import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { failDb } from "./nexus-admin.server";
import { requireNexusManager, requireNexusAdmin } from "./nexus-auth.middleware";
import { loadTournamentDetail } from "./nexus-tournament-detail.server";
import { logAction, recomputeSnapshot, tfMonth, type TournamentStatus } from "./nexus-admin.functions";
import { mondayOfWeek, toLocalDateStr } from "./utils";
import { getManagerGameIds, assertManagerOwnsGame } from "./nexus-manager-shared";
import { loadGamePlayers } from "./nexus-manager-players.server";
import { PLAYER_STATUSES, type PlayerStatus } from "./player-status";


export const getManagerAnalyticsOverview = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator(
    (d: {
      game_id: string;
      zone?: string;
      store_id?: string;
      date_from?: string;
      date_to?: string;
    }) =>
      z
        .object({
          game_id: z.string().uuid(),
          zone: z.string().max(50).optional(),
          store_id: z.string().uuid().optional(),
          date_from: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          date_to: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    await assertManagerOwnsGame(admin, player, data.game_id);

    const { data: schedules } = await admin
      .from("store_schedules")
      .select("store_id")
      .eq("game_id", data.game_id);
    const storeIdsWithGame = Array.from(new Set((schedules ?? []).map((s: any) => s.store_id)));
    if (storeIdsWithGame.length === 0) {
      return { total_players: 0, zone_breakdown: [], store_ranking: [], stores_offering_count: 0 };
    }

    let storeQuery = admin
      .from("stores")
      .select("id, name, city, zone")
      .in("id", storeIdsWithGame)
      .eq("is_active", true);
    if (data.zone) storeQuery = storeQuery.eq("zone", data.zone);
    if (data.store_id) storeQuery = storeQuery.eq("id", data.store_id);
    const { data: stores } = await storeQuery;
    const filteredStoreIds = (stores ?? []).map((s: any) => s.id);
    const storeMap = new Map((stores ?? []).map((s: any) => [s.id, s]));

    if (filteredStoreIds.length === 0) {
      return { total_players: 0, zone_breakdown: [], store_ranking: [], stores_offering_count: 0 };
    }

    let tQuery = admin
      .from("tournaments")
      .select("id, store_id, tournament_date")
      .eq("game_id", data.game_id)
      .eq("status", "PUBLISHED")
      .in("store_id", filteredStoreIds);
    if (data.date_from) tQuery = tQuery.gte("tournament_date", data.date_from);
    if (data.date_to) tQuery = tQuery.lte("tournament_date", data.date_to);
    const { data: tournaments } = await tQuery;
    const tournamentIds = (tournaments ?? []).map((t: any) => t.id);
    const tournamentMap = new Map((tournaments ?? []).map((t: any) => [t.id, t]));

    if (tournamentIds.length === 0) {
      return {
        total_players: 0,
        zone_breakdown: (stores ?? []).reduce((acc: any[], s: any) => {
          const existing = acc.find((z) => z.zone === s.zone);
          if (existing) existing.store_count++;
          else acc.push({ zone: s.zone, store_count: 1, players: 0 });
          return acc;
        }, []),
        store_ranking: [],
        stores_offering_count: filteredStoreIds.length,
      };
    }

    const { data: results } = await admin
      .from("tournament_results")
      .select("player_id, tournament_id")
      .in("tournament_id", tournamentIds);

    const allPlayers = new Set((results ?? []).map((r: any) => r.player_id));

    const playersByStore = new Map<string, Set<string>>();
    for (const r of results ?? []) {
      const t = tournamentMap.get(r.tournament_id);
      if (!t) continue;
      const set = playersByStore.get(t.store_id) ?? new Set<string>();
      set.add(r.player_id);
      playersByStore.set(t.store_id, set);
    }

    const storeRanking = Array.from(playersByStore.entries())
      .map(([storeId, playerSet]) => {
        const store = storeMap.get(storeId);
        return {
          store_id: storeId,
          store_name: store?.name ?? "—",
          city: store?.city ?? "—",
          zone: store?.zone ?? "—",
          players: playerSet.size,
        };
      })
      .sort((a, b) => b.players - a.players);

    const zoneMap = new Map<string, { store_count: number; players: Set<string> }>();
    for (const s of stores ?? []) {
      const z = (s as any).zone ?? "—";
      const entry = zoneMap.get(z) ?? { store_count: 0, players: new Set<string>() };
      entry.store_count++;
      zoneMap.set(z, entry);
    }
    for (const r of results ?? []) {
      const t = tournamentMap.get(r.tournament_id);
      if (!t) continue;
      const store = storeMap.get(t.store_id);
      const z = store?.zone ?? "—";
      const entry = zoneMap.get(z);
      if (entry) entry.players.add(r.player_id);
    }
    const zoneBreakdown = Array.from(zoneMap.entries()).map(([zone, v]) => ({
      zone,
      store_count: v.store_count,
      players: v.players.size,
    }));

    return {
      total_players: allPlayers.size,
      zone_breakdown: zoneBreakdown,
      store_ranking: storeRanking,
      stores_offering_count: filteredStoreIds.length,
    };
  });

export const managerRepublishTournament = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { tournament_id: string }) =>
    z.object({ tournament_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: t } = await admin
      .from("tournaments")
      .select("status, game_id")
      .eq("id", data.tournament_id)
      .maybeSingle();
    if (!t || (t as any).status !== "UNPUBLISHED") {
      throw new Error("Solo se pueden re-publicar torneos en estado Despublicado");
    }
    await assertManagerOwnsGame(admin, player, (t as any).game_id);
    const now = new Date();
    const undoDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const { error } = await admin
      .from("tournaments")
      .update({
        status: "APPROVED",
        approved_at: now.toISOString(),
        undo_deadline: undoDeadline.toISOString(),
        approved_by: player.id,
        unpublish_reason: null,
      } as any)
      .eq("id", data.tournament_id);
    if (error) failDb(error);
    return { success: true };
  });

export const getManagerAnalyticsTrend = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator(
    (d: {
      game_id: string;
      zone?: string;
      store_id?: string;
      date_from?: string;
      date_to?: string;
    }) =>
      z
        .object({
          game_id: z.string().uuid(),
          zone: z.string().max(50).optional(),
          store_id: z.string().uuid().optional(),
          date_from: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          date_to: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    await assertManagerOwnsGame(admin, player, data.game_id);

    const { data: schedules } = await admin
      .from("store_schedules")
      .select("store_id")
      .eq("game_id", data.game_id);
    const storeIdsWithGame = Array.from(new Set((schedules ?? []).map((s: any) => s.store_id)));
    if (storeIdsWithGame.length === 0) {
      return { monthly_trend: [], status_summary: null, peak_days: [] };
    }

    let storeQuery = admin
      .from("stores")
      .select("id")
      .in("id", storeIdsWithGame)
      .eq("is_active", true);
    if (data.zone) storeQuery = storeQuery.eq("zone", data.zone);
    if (data.store_id) storeQuery = storeQuery.eq("id", data.store_id);
    const { data: stores } = await storeQuery;
    const filteredStoreIds = (stores ?? []).map((s: any) => s.id);
    if (filteredStoreIds.length === 0) {
      return { monthly_trend: [], status_summary: null, peak_days: [] };
    }

    let tQuery = admin
      .from("tournaments")
      .select("id, store_id, tournament_date")
      .eq("game_id", data.game_id)
      .eq("status", "PUBLISHED")
      .in("store_id", filteredStoreIds)
      .order("tournament_date", { ascending: true });
    if (data.date_from) tQuery = tQuery.gte("tournament_date", data.date_from);
    if (data.date_to) tQuery = tQuery.lte("tournament_date", data.date_to);
    const { data: tournaments } = await tQuery;

    if (!tournaments || tournaments.length === 0) {
      return { monthly_trend: [], status_summary: null, peak_days: [] };
    }

    const tournamentIds = tournaments.map((t: any) => t.id);
    const { data: results } = await admin
      .from("tournament_results")
      .select("player_id, tournament_id")
      .in("tournament_id", tournamentIds);

    const tournamentMap = new Map<string, any>(tournaments.map((t: any) => [t.id, t]));

    const playerDates = new Map<string, string[]>();
    for (const r of results ?? []) {
      const t = tournamentMap.get((r as any).tournament_id);
      if (!t) continue;
      const arr = playerDates.get((r as any).player_id) ?? [];
      arr.push(t.tournament_date);
      playerDates.set((r as any).player_id, arr);
    }
    for (const arr of playerDates.values()) arr.sort();

    // ── Primera aparición de cada jugador (todo el historial del TCG, sin filtro de fecha) ──
    const { data: allTimeResults } = await admin
      .from("tournament_results")
      .select("player_id, tournament_id")
      .in(
        "tournament_id",
        await admin
          .from("tournaments")
          .select("id")
          .eq("game_id", data.game_id)
          .eq("status", "PUBLISHED")
          .in("store_id", filteredStoreIds)
          .then(({ data: ts }) => (ts ?? []).map((t: any) => t.id)),
      );

    const firstAppearance = new Map<string, string>(); // player_id → "YYYY-MM"
    for (const r of allTimeResults ?? []) {
      const t = tournamentMap.get(r.tournament_id);
      const date = t?.tournament_date;
      if (!date) continue;
      const month = date.slice(0, 7);
      const existing = firstAppearance.get(r.player_id);
      if (!existing || month < existing) firstAppearance.set(r.player_id, month);
    }

    // ── Tendencia mensual: jugadores únicos + nuevos vs recurrentes ────
    const monthlyMap = new Map<
      string,
      { total: Set<string>; new: Set<string>; returning: Set<string> }
    >();
    for (const r of results ?? []) {
      const t = tournamentMap.get(r.tournament_id);
      if (!t) continue;
      const monthKey = t.tournament_date.slice(0, 7);
      const entry = monthlyMap.get(monthKey) ?? {
        total: new Set<string>(),
        new: new Set<string>(),
        returning: new Set<string>(),
      };
      entry.total.add(r.player_id);
      if (firstAppearance.get(r.player_id) === monthKey) {
        entry.new.add(r.player_id);
      } else {
        entry.returning.add(r.player_id);
      }
      monthlyMap.set(monthKey, entry);
    }
    const monthly_trend = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        players: v.total.size,
        new_players: v.new.size,
        returning_players: v.returning.size,
      }));

    const dayMap = new Map<string, Set<string>>();
    for (const r of results ?? []) {
      const t = tournamentMap.get((r as any).tournament_id);
      if (!t) continue;
      const s = dayMap.get(t.tournament_date) ?? new Set<string>();
      s.add((r as any).player_id);
      dayMap.set(t.tournament_date, s);
    }
    const dayList = Array.from(dayMap.entries())
      .map(([date, players]) => ({ date, players: players.size }))
      .sort((a, b) => b.players - a.players);
    const peak_days = [
      ...dayList.slice(0, 3).map((d) => ({ ...d, type: "peak" as const })),
      ...dayList
        .slice(-3)
        .reverse()
        .map((d) => ({ ...d, type: "valley" as const })),
    ];

    // Estado a fecha de hoy de quienes jugaron en el periodo filtrado.
    const statusById = new Map(
      (await loadGamePlayers(admin, data.game_id, filteredStoreIds)).map((p) => [p.player_id, p.status]),
    );
    const status_summary = Object.fromEntries(PLAYER_STATUSES.map((s) => [s, 0])) as Record<
      PlayerStatus,
      number
    >;
    for (const pid of playerDates.keys()) {
      const status = statusById.get(pid);
      if (status) status_summary[status]++;
    }

    return { monthly_trend, status_summary, peak_days };
  });


// Jugadores de los TCGs que modera el manager, en todas las tiendas.
export const getManagerPlayers = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { game_id?: string }) =>
    z.object({ game_id: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const gameIds = await getManagerGameIds(admin, player);
    const { data: games, error } = gameIds.length
      ? await admin.from("games").select("id, name").in("id", gameIds).order("name")
      : { data: [] as Array<{ id: string; name: string }>, error: null };
    if (error) failDb(error);

    const gameId = data.game_id ?? games?.[0]?.id ?? null;
    const summary = Object.fromEntries(PLAYER_STATUSES.map((s) => [s, 0])) as Record<
      PlayerStatus,
      number
    >;
    if (!gameId) return { games: games ?? [], game_id: null, players: [], summary };

    await assertManagerOwnsGame(admin, player, gameId);
    const players = await loadGamePlayers(admin, gameId);
    for (const p of players) summary[p.status]++;
    return { games: games ?? [], game_id: gameId, players, summary };
  });

// Vista de staff: solo resultados en los TCGs del manager, aunque el perfil sea
// privado. Mismo error si no existe o no jugó ahí, para no revelar quién está registrado.
export const getManagerPlayerDetail = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { player_id: string }) =>
    z.object({ player_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const gameIds = await getManagerGameIds(admin, player);
    const notFound = "Este jugador no ha jugado en tus TCGs";
    if (gameIds.length === 0) throw new Error(notFound);

    const { data: rows, error } = await admin
      .from("tournament_results")
      .select(
        "rank, points_earned, tournaments!inner(id, tournament_date, game_id, status, games(name), stores(name))",
      )
      .eq("player_id", data.player_id)
      .in("tournaments.game_id", gameIds)
      .in("tournaments.status", ["APPROVED", "PUBLISHED"]);
    if (error) failDb(error);
    if (!rows?.length) throw new Error(notFound);

    const { data: target, error: targetError } = await admin
      .from("players")
      .select("geek_tag")
      .eq("id", data.player_id)
      .single();
    if (targetError) failDb(targetError);

    const tournaments = rows
      .map((r) => ({
        id: r.tournaments.id,
        date: r.tournaments.tournament_date,
        game: r.tournaments.games?.name ?? "—",
        store: r.tournaments.stores?.name ?? "—",
        rank: r.rank,
        points: Math.round(r.points_earned ?? 0),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return {
      geek_tag: target.geek_tag,
      total_points: tournaments.reduce((sum, t) => sum + t.points, 0),
      last_visit: tournaments[0].date,
      tournaments,
    };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireNexusOrganizer } from "./nexus-auth.middleware";
import { getNexusAdmin, failDb } from "./nexus-admin.server";
import { todayInMexicoStr, mondayOfWeek, toLocalDateStr } from "./utils";
import type { TablesInsert } from "./database.types";
import type { TournamentStatus } from "./nexus-admin-shared";


type PlayerCategory = "recurrente" | "ocasional" | "una_vez" | "inactivo";

const CATEGORY_RANK: Record<PlayerCategory, number> = {
  recurrente: 3,
  ocasional: 2,
  una_vez: 1,
  inactivo: 0,
};

function getWeekRanges(start: Date, end: Date): Array<{ start: Date; end: Date }> {
  const weeks: Array<{ start: Date; end: Date }> = [];
  let cur = mondayOfWeek(start);
  while (cur <= end) {
    const weekEnd = new Date(cur);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    weeks.push({ start: new Date(cur), end: weekEnd });
    cur = new Date(cur);
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

function classifyPlayer(
  tournamentDates: string[], // ISO date strings "YYYY-MM-DD", sorted
  rangeStart: Date,
  rangeEnd: Date,
): PlayerCategory {
  const datesInRange = tournamentDates
    .map((d) => new Date(d + "T12:00:00"))
    .filter((d) => d >= rangeStart && d <= rangeEnd);

  if (datesInRange.length === 0) return "inactivo";
  if (datesInRange.length === 1) return "una_vez";

  const weeks = getWeekRanges(rangeStart, rangeEnd);
  const allWeeksCovered = weeks.every((w) =>
    datesInRange.some((d) => d >= w.start && d <= w.end),
  );

  return allWeeksCovered ? "recurrente" : "ocasional";
}

export const getStorePageViewAnalytics = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: { store_id?: string; days?: number }) =>
    z
      .object({
        store_id: z.string().uuid().optional(),
        days: z.number().int().min(1).max(365).default(30),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    let storeId = player.home_store_id;
    if (data.store_id) {
      if (player.role === "admin") {
        storeId = data.store_id;
      } else if (data.store_id !== player.home_store_id) {
        throw new Error("No tienes permiso para ver analytics de esta tienda");
      }
    }
    if (!storeId) {
      throw new Error("Esta tienda no tiene página pública registrada aún");
    }

    const since = new Date();
    since.setDate(since.getDate() - data.days);

    const { data: rows, error } = await admin
      .from("store_page_views")
      .select("section")
      .eq("store_id", storeId)
      .gte("viewed_at", since.toISOString());
    if (error) failDb(error);

    const counts = { profile: 0, calendario: 0, liga_interna: 0 };
    for (const row of (rows ?? []) as Array<{ section: keyof typeof counts }>) {
      counts[row.section] = (counts[row.section] ?? 0) + 1;
    }

    return {
      days: data.days,
      total_views: rows?.length ?? 0,
      by_section: [
        { section: "profile", label: "Perfil de tienda", views: counts.profile },
        { section: "calendario", label: "Calendario", views: counts.calendario },
        { section: "liga_interna", label: "Liga interna / leaderboard", views: counts.liga_interna },
      ],
    };
  });

export const getStoreAnalytics = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator(
    (d: {
      store_id?: string;
      date_from?: string;
      date_to?: string;
      game_id?: string;
      league_id?: string | null;
    }) =>
      z
        .object({
          store_id: z.string().uuid().optional(),
          date_from: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          date_to: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          game_id: z.string().uuid().optional(),
          // undefined/null = Circuito Nacional (league_id IS NULL, default histórico);
          // uuid = esa liga interna específica. Épica 4: nunca se mezclan.
          league_id: z.string().uuid().nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    // Scope: organizer can only query their own store; admin can pass any store_id
    let storeId = player.home_store_id;
    if (data.store_id) {
      if (player.role === "admin") {
        storeId = data.store_id;
      } else if (data.store_id !== player.home_store_id) {
        throw new Error("No tienes permiso para ver analytics de esta tienda");
      }
    }
    if (!storeId) {
      throw new Error("Esta tienda no tiene torneos registrados aún");
    }

    // Threshold settings (defaults if no row exists)
    const { data: settings } = await admin
      .from("store_analytics_settings")
      .select("inactive_threshold_days, at_risk_threshold_days")
      .eq("store_id", storeId)
      .maybeSingle();
    const inactiveThresholdDays = settings?.inactive_threshold_days ?? 45;
    const atRiskThresholdDays = settings?.at_risk_threshold_days ?? 21;

    // Date range: default = first tournament of store -> today
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let rangeStart: Date;
    let rangeEnd: Date = data.date_to ? new Date(data.date_to + "T23:59:59") : today;

    if (data.date_from) {
      rangeStart = new Date(data.date_from + "T00:00:00");
    } else {
      const { data: firstT } = await admin
        .from("tournaments")
        .select("tournament_date")
        .eq("store_id", storeId)
        .order("tournament_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      rangeStart = firstT?.tournament_date
        ? new Date(firstT.tournament_date + "T00:00:00")
        : new Date(today.getFullYear(), today.getMonth(), 1);
    }

    // Épica 4: Circuito Nacional y ligas internas se analizan por separado —
    // nunca se combinan sus jugadores/torneos en la misma métrica.
    const { data: activeLeagues } = await admin
      .from("store_leagues")
      .select("id, name")
      .eq("store_id", storeId)
      .eq("status", "active")
      .order("name");

    let tournamentsQuery = admin
      .from("tournaments")
      .select("id, tournament_date, game_id")
      .eq("store_id", storeId)
      .in("status", ["APPROVED", "PUBLISHED"]);
    tournamentsQuery = data.league_id
      ? tournamentsQuery.eq("league_id", data.league_id)
      : tournamentsQuery.is("league_id", null);
    const { data: tournamentsInStore } = await tournamentsQuery;

    const tournamentIds = (tournamentsInStore ?? []).map((t) => t.id);
    const tournamentMap = new Map(
      (tournamentsInStore ?? []).map((t) => [t.id, t]),
    );

    const { data: allResults } = tournamentIds.length
      ? await admin
          .from("tournament_results")
          .select("player_id, tournament_id, points_earned")
          .in("tournament_id", tournamentIds)
      : { data: [] as Array<{ player_id: string; tournament_id: string; points_earned: number | null }> };

    // Build per-player list of tournament dates (all-time, for inactivity calc)
    let playerDatesAll = new Map<string, string[]>();
    for (const r of allResults ?? []) {
      const t = tournamentMap.get(r.tournament_id);
      if (!t) continue;
      const arr = playerDatesAll.get(r.player_id) ?? [];
      arr.push(t.tournament_date);
      playerDatesAll.set(r.player_id, arr);
    }
    for (const arr of playerDatesAll.values()) arr.sort();

    const playerIds = Array.from(playerDatesAll.keys());
    const { data: playersData } = playerIds.length
      ? await admin.from("players").select("id, geek_tag").in("id", playerIds)
      : { data: [] as Array<{ id: string; geek_tag: string }> };
    const geekTagMap = new Map((playersData ?? []).map((p) => [p.id, p.geek_tag]));

    // gameBreakdown is computed below from the unfiltered allResults/tournamentMap so
    // the TCG tabs always show every game in the store. The filter for game_id is
    // applied AFTER gameBreakdown, replacing playerDatesAll for all downstream metrics.

    // ---------- 1. Total players in range (computed AFTER possible game_id filter) ----------
    const computePlayersInRange = () => {
      const s = new Set<string>();
      for (const [pid, dates] of playerDatesAll.entries()) {
        const inRange = dates.some((d) => {
          const dt = new Date(d + "T12:00:00");
          return dt >= rangeStart && dt <= rangeEnd;
        });
        if (inRange) s.add(pid);
      }
      return s;
    };
    let playersInRange = computePlayersInRange();

    // ---------- 2. Breakdown by TCG (only games in store_schedules) ----------
    const { data: schedules } = await admin
      .from("store_schedules")
      .select("game_id, games(id, name)")
      .eq("store_id", storeId);
    const storeGameIds = Array.from(
      new Set((schedules ?? []).map((s: any) => s.game_id)),
    );
    const gameNameMap = new Map(
      (schedules ?? []).map((s: any) => [s.game_id, s.games?.name ?? "—"]),
    );

    const gameBreakdown = storeGameIds.map((gameId) => {
      const players = new Set<string>();
      let totalEntries = 0;
      for (const r of allResults ?? []) {
        const t = tournamentMap.get(r.tournament_id);
        if (!t || t.game_id !== gameId) continue;
        const dt = new Date(t.tournament_date + "T12:00:00");
        if (dt >= rangeStart && dt <= rangeEnd) {
          players.add(r.player_id);
          totalEntries++;
        }
      }
      return {
        game_id: gameId,
        game_name: gameNameMap.get(gameId) ?? "—",
        players: players.size,
        total_entries: totalEntries,
      };
    });

    // If filtering by game_id, rebuild playerDatesAll using only that game's tournaments.
    // gameBreakdown above intentionally stays unfiltered so the tabs always show every TCG.
    if (data.game_id) {
      const filtered = new Map<string, string[]>();
      for (const r of allResults ?? []) {
        const t = tournamentMap.get(r.tournament_id);
        if (!t || t.game_id !== data.game_id) continue;
        const arr = filtered.get(r.player_id) ?? [];
        arr.push(t.tournament_date);
        filtered.set(r.player_id, arr);
      }
      for (const arr of filtered.values()) arr.sort();
      playerDatesAll = filtered;
      playersInRange = computePlayersInRange();
    }


    // Total attendance = suma de inscripciones (no jugadores únicos), respetando
    // el filtro de game_id ya aplicado a allResults/tournamentMap arriba.
    const resultsInGame = data.game_id
      ? (allResults ?? []).filter((r) => tournamentMap.get(r.tournament_id)?.game_id === data.game_id)
      : (allResults ?? []);

    // ---------- 3. Attendance trend (weekly) ----------
    // playerDatesAll ya trae TODO el historial del jugador en esta tienda (sin
    // filtro de rango, solo de liga/TCG), así que su primera fecha ahí mismo
    // es su "primera vez" — no hace falta otra query para nuevo vs recurrente.
    const firstDateByPlayer = new Map<string, string>();
    for (const [pid, dates] of playerDatesAll.entries()) {
      if (dates[0]) firstDateByPlayer.set(pid, dates[0]);
    }

    const weeks = getWeekRanges(rangeStart, rangeEnd);

    // Jugadores "perdidos" por semana (barra negativa): un jugador se cuenta
    // UNA sola vez, en la semana en que su última visita cumple
    // inactive_threshold_days — no en cada semana siguiente que sigue inactivo.
    const churnedCountByWeekIndex = new Array(weeks.length).fill(0);
    for (const dates of playerDatesAll.values()) {
      const lastDate = dates[dates.length - 1];
      if (!lastDate) continue;
      const churnDate = new Date(lastDate + "T12:00:00");
      churnDate.setDate(churnDate.getDate() + inactiveThresholdDays);
      const weekIdx = weeks.findIndex((w) => churnDate >= w.start && churnDate <= w.end);
      if (weekIdx >= 0) churnedCountByWeekIndex[weekIdx]++;
    }

    const attendanceTrend = weeks.map((w, wIdx) => {
      const players = new Set<string>();
      let newPlayers = 0;
      let returningPlayers = 0;
      let totalEntries = 0;
      for (const [pid, dates] of playerDatesAll.entries()) {
        const has = dates.some((d) => {
          const dt = new Date(d + "T12:00:00");
          return dt >= w.start && dt <= w.end;
        });
        if (has) {
          players.add(pid);
          const firstDate = firstDateByPlayer.get(pid);
          const firstDt = firstDate ? new Date(firstDate + "T12:00:00") : null;
          if (firstDt && firstDt >= w.start && firstDt <= w.end) newPlayers++;
          else returningPlayers++;
        }
      }
      const tournamentIdsThisWeek = new Set<string>();
      for (const r of resultsInGame) {
        const t = tournamentMap.get(r.tournament_id);
        if (!t) continue;
        const dt = new Date(t.tournament_date + "T12:00:00");
        if (dt >= w.start && dt <= w.end) {
          totalEntries++;
          tournamentIdsThisWeek.add(r.tournament_id);
        }
      }
      return {
        week_start: w.start.toISOString().split("T")[0],
        players: players.size,
        new_players: newPlayers,
        returning_players: returningPlayers,
        churned_players: -churnedCountByWeekIndex[wIdx],
        total_entries: totalEntries,
        // "players" es el total ÚNICO de la semana, no de un torneo — si una
        // tienda corre 2+ torneos la misma semana, este número deduplica
        // entre ellos. tournament_count deja eso visible en el tooltip.
        tournament_count: tournamentIdsThisWeek.size,
      };
    });

    let totalAttendance = 0;
    let totalPoints = 0;
    const tournamentIdsInRange = new Set<string>();
    const pointsByPlayerInRange = new Map<string, number>();
    for (const r of resultsInGame) {
      const t = tournamentMap.get(r.tournament_id);
      if (!t) continue;
      const dt = new Date(t.tournament_date + "T12:00:00");
      if (dt >= rangeStart && dt <= rangeEnd) {
        totalAttendance++;
        totalPoints += r.points_earned ?? 0;
        tournamentIdsInRange.add(r.tournament_id);
        pointsByPlayerInRange.set(r.player_id, (pointsByPlayerInRange.get(r.player_id) ?? 0) + (r.points_earned ?? 0));
      }
    }
    // Promedio de jugadores por torneo: asistencia total entre torneos con al
    // menos un resultado en el rango — un torneo sin resultados aún no cuenta.
    const avgPlayersPerTournament =
      tournamentIdsInRange.size > 0 ? totalAttendance / tournamentIdsInRange.size : 0;
    // Puntos por jugador en tienda: puntos totales entre jugadores únicos del rango.
    const avgPointsPerPlayer = playersInRange.size > 0 ? totalPoints / playersInRange.size : 0;

    // ---------- 4. Player classification (range + current) ----------
    const currentRangeEnd = today;
    const currentRangeStart = new Date(today);
    currentRangeStart.setDate(currentRangeStart.getDate() - 45); // matches inactive threshold

    const classification = Array.from(playerDatesAll.entries())
      .map(([pid, dates]) => {
        const categoryInRange = classifyPlayer(dates, rangeStart, rangeEnd);
        const categoryCurrent = classifyPlayer(dates, currentRangeStart, currentRangeEnd);
        const lastVisit = dates[dates.length - 1];
        return {
          player_id: pid,
          geek_tag: geekTagMap.get(pid) ?? "—",
          tournaments_in_range: dates.filter((d) => {
            const dt = new Date(d + "T12:00:00");
            return dt >= rangeStart && dt <= rangeEnd;
          }).length,
          category_range: categoryInRange,
          category_current: categoryCurrent,
          last_visit: lastVisit,
          trend:
            CATEGORY_RANK[categoryCurrent] === CATEGORY_RANK[categoryInRange]
              ? "same"
              : CATEGORY_RANK[categoryCurrent] < CATEGORY_RANK[categoryInRange]
                ? "down"
                : "up",
        };
      })
      .filter((c) => playersInRange.has(c.player_id) || c.category_current !== c.category_range);

    // ---------- 5. Category summary (donut) ----------
    const categorySummary: Record<PlayerCategory, number> = {
      recurrente: 0,
      ocasional: 0,
      una_vez: 0,
      inactivo: 0,
    };
    for (const c of classification) {
      if (playersInRange.has(c.player_id)) {
        categorySummary[c.category_range]++;
      }
    }

    // ---------- 6. At-risk players (always vs today) ----------
    const atRisk = Array.from(playerDatesAll.entries())
      .map(([pid, dates]) => {
        const lastVisit = new Date(dates[dates.length - 1] + "T12:00:00");
        const daysSince = Math.floor((today.getTime() - lastVisit.getTime()) / 86_400_000);
        return { player_id: pid, geek_tag: geekTagMap.get(pid) ?? "—", days_since: daysSince };
      })
      .filter((p) => p.days_since > atRiskThresholdDays && p.days_since <= inactiveThresholdDays)
      .sort((a, b) => a.days_since - b.days_since);

    // ---------- 7. Top players ----------
    const topPlayers = Array.from(playerDatesAll.entries())
      .map(([pid, dates]) => ({
        player_id: pid,
        geek_tag: geekTagMap.get(pid) ?? "—",
        tournaments: dates.filter((d) => {
          const dt = new Date(d + "T12:00:00");
          return dt >= rangeStart && dt <= rangeEnd;
        }).length,
        points: pointsByPlayerInRange.get(pid) ?? 0,
      }))
      .filter((p) => p.tournaments > 0)
      .sort((a, b) => b.tournaments - a.tournaments)
      .slice(0, 100);

    return {
      store_id: storeId,
      league_id: data.league_id ?? null,
      available_leagues: activeLeagues ?? [],
      range: {
        start: rangeStart.toISOString().split("T")[0],
        end: rangeEnd.toISOString().split("T")[0],
      },
      settings: {
        inactive_threshold_days: inactiveThresholdDays,
        at_risk_threshold_days: atRiskThresholdDays,
      },
      total_players: playersInRange.size,
      total_attendance: totalAttendance,
      avg_players_per_tournament: Math.round(avgPlayersPerTournament * 10) / 10,
      avg_points_per_player: Math.round(avgPointsPerPlayer * 10) / 10,
      game_breakdown: gameBreakdown,
      attendance_trend: attendanceTrend,
      category_summary: categorySummary,
      classification,
      at_risk: atRisk,
      top_players: topPlayers,
    };
  });

// ---------- Historial de Torneos (organizer scoped) ----------


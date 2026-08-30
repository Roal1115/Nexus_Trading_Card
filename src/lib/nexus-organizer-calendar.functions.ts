import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireNexusOrganizer } from "./nexus-auth.middleware";
import { getNexusAdmin, failDb } from "./nexus-admin.server";
import { todayInMexicoStr, mondayOfWeek, toLocalDateStr } from "./utils";
import type { TablesInsert } from "./database.types";
import type { TournamentStatus } from "./nexus-admin-shared";


export const getOrganizerCalendar = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: { week_start?: string }) => z.object({ week_start: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    const today = new Date();
    let monday: Date;
    if (data.week_start) {
      monday = new Date(data.week_start + "T00:00:00");
    } else {
      monday = mondayOfWeek(today);
    }
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    const mondayStr = toLocalDateStr(monday);
    const sundayStr = toLocalDateStr(sunday);

    const emptyStats = {
      total_overdue: 0,
      uploaded_so_far: 0,
      days_elapsed: 0,
      total_expected: 0,
      today_expected: 0,
      today_submitted: 0,
    };

    if (!player.home_store_id) {
      return { week_start: mondayStr, week_end: sundayStr, entries: [], stats: emptyStats };
    }

    const { data: schedules, error: se } = await admin
      .from("store_schedules")
      .select("id, store_id, game_id, day_of_week, start_time, stores(id, name, city, state, zone, phone, instagram)")
      .eq("store_id", player.home_store_id);
    if (se) failDb(se);

    // Épica 4: horarios propios de ligas internas que NO comparten slot con el
    // circuito nacional se agregan como entradas de calendario aparte; los que
    // sí comparten (shares_national_slot) solo etiquetan la entrada nacional.
    const { data: leagueSchedules, error: lse } = await admin
      .from("store_league_schedules")
      .select("id, league_id, game_id, day_of_week, start_time, shares_national_slot, national_schedule_id, store_leagues(name, status)")
      .eq("store_id", player.home_store_id);
    if (lse) failDb(lse);

    const activeLeagueSchedules = (leagueSchedules ?? []).filter(
      (s: any) => (Array.isArray(s.store_leagues) ? s.store_leagues[0] : s.store_leagues)?.status === "active",
    );
    const sharedLeagueNameByNationalId = new Map<string, string>();
    activeLeagueSchedules
      .filter((s: any) => s.shares_national_slot && s.national_schedule_id)
      .forEach((s: any) => {
        const name = (Array.isArray(s.store_leagues) ? s.store_leagues[0] : s.store_leagues)?.name ?? null;
        if (name) sharedLeagueNameByNationalId.set(s.national_schedule_id, name);
      });
    const ownLeagueSchedules = activeLeagueSchedules.filter((s: any) => !s.shares_national_slot);

    const gameIds = Array.from(
      new Set([...(schedules ?? []).map((s: any) => s.game_id), ...ownLeagueSchedules.map((s: any) => s.game_id)]),
    );
    const { data: gamesData } = gameIds.length
      ? await admin.from("games").select("id, name").in("id", gameIds)
      : { data: [] as any[] };
    const gameNamesMap = new Map((gamesData ?? []).map((g: any) => [g.id, g.name]));

    const { data: weekTournaments } = await admin
      .from("tournaments")
      .select("id, store_id, game_id, tournament_date, status, rejection_reason, league_id")
      .eq("store_id", player.home_store_id)
      .gte("tournament_date", mondayStr)
      .lte("tournament_date", sundayStr);

    const tournamentMap = new Map<string, any>();
    (weekTournaments ?? []).forEach((t: any) => {
      const d = new Date(t.tournament_date + "T12:00:00");
      tournamentMap.set(`${t.store_id}-${t.game_id}-${d.getDay()}-${t.league_id ?? "national"}`, t);
    });

    const nowMs = Date.now();
    const buildEntry = (
      s: { store_id: string; game_id: string; day_of_week: number; start_time: string; stores?: any },
      leagueId: string | null,
      leagueName: string | null,
    ) => {
      const store = s.stores;
      const tournament = tournamentMap.get(`${s.store_id}-${s.game_id}-${s.day_of_week}-${leagueId ?? "national"}`);
      const offset = s.day_of_week === 0 ? 6 : s.day_of_week - 1;
      const entryDate = new Date(monday);
      entryDate.setDate(monday.getDate() + offset);
      const entryDateStr = toLocalDateStr(entryDate);
      const [h, m] = String(s.start_time).split(":").map(Number);
      const tStart = new Date(entryDate);
      tStart.setHours(h, m, 0, 0);
      const tEnd = new Date(tStart);
      tEnd.setHours(h + 3, m, 0, 0);
      const isToday = entryDate.toDateString() === today.toDateString();
      const isPast = entryDate < today && !isToday;
      const isFuture = entryDate > today && !isToday;
      const isOngoing = isToday && nowMs >= tStart.getTime() && nowMs <= tEnd.getTime();
      const hasEnded = isPast || (isToday && nowMs > tEnd.getTime());
      const isSubmitted =
        tournament &&
        (tournament.status !== "DRAFT" || (tournament.status === "DRAFT" && !tournament.rejection_reason));
      let reportStatus: "submitted" | "overdue" | "pending" | "upcoming";
      if (isSubmitted) reportStatus = "submitted";
      else if (hasEnded && !tournament) reportStatus = "overdue";
      else if (isFuture) reportStatus = "upcoming";
      else reportStatus = "pending";
      return {
        id: `${s.store_id}-${s.game_id}-${s.day_of_week}-${leagueId ?? "national"}`,
        store_id: s.store_id,
        game_id: s.game_id,
        game_name: gameNamesMap.get(s.game_id) ?? "—",
        store_name: store?.name ?? "—",
        city: store?.city ?? "—",
        zone: store?.zone ?? "Zona Extendida",
        phone: store?.phone ?? null,
        instagram: store?.instagram ?? null,
        day_of_week: s.day_of_week,
        date: entryDateStr,
        start_time: String(s.start_time).slice(0, 5),
        is_past: isPast,
        is_today: isToday,
        is_future: isFuture,
        is_ongoing: isOngoing,
        has_ended: hasEnded,
        report_status: reportStatus,
        tournament_id: tournament?.id ?? null,
        tournament_status: tournament?.status ?? null,
        league_id: leagueId,
        league_name: leagueName,
      };
    };

    const entries = [
      ...(schedules ?? []).map((s: any) => buildEntry(s, null, sharedLeagueNameByNationalId.get(s.id) ?? null)),
      ...ownLeagueSchedules.map((s: any) =>
        buildEntry(
          s,
          s.league_id,
          (Array.isArray(s.store_leagues) ? s.store_leagues[0] : s.store_leagues)?.name ?? null,
        ),
      ),
    ];

    const elapsedEntries = entries.filter((e: any) => !e.is_future);
    const uploadedSoFar = elapsedEntries.filter((e: any) => e.report_status === "submitted").length;
    const totalOverdue = entries.filter((e: any) => e.report_status === "overdue").length;
    return {
      week_start: mondayStr,
      week_end: sundayStr,
      entries,
      stats: {
        total_overdue: totalOverdue,
        uploaded_so_far: uploadedSoFar,
        days_elapsed: elapsedEntries.length,
        total_expected: entries.length,
        today_expected: entries.filter((e: any) => e.is_today).length,
        today_submitted: entries.filter((e: any) => e.is_today && e.report_status === "submitted").length,
      },
    };
  });

// ---------- Store Analytics ----------

type PlayerCategory = "recurrente" | "ocasional" | "una_vez" | "inactivo";



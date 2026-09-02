import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { failDb } from "./nexus-admin.server";
import { requireNexusManager, requireNexusAdmin } from "./nexus-auth.middleware";
import { loadTournamentDetail } from "./nexus-tournament-detail.server";
import { logAction, recomputeSnapshot, tfMonth, type TournamentStatus } from "./nexus-admin.functions";
import { mondayOfWeek, toLocalDateStr } from "./utils";
import { getManagerGameIds, assertManagerOwnsGame } from "./nexus-manager-shared";


export const getManagerHistory = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator(
    (d: { action_type?: string; date_from?: string; date_to?: string; page?: number }) =>
      z
        .object({
          action_type: z.string().optional(),
          date_from: z.string().optional(),
          date_to: z.string().optional(),
          page: z.number().min(1).default(1),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const PAGE_SIZE = 25;
    const page = data.page ?? 1;
    const offset = (page - 1) * PAGE_SIZE;

    let q = admin
      .from("admin_audit_log")
      .select("*", { count: "exact" })
      .eq("actor_id", player.id)
      .in("action", ["TOURNAMENT_APPROVED", "TOURNAMENT_REJECTED", "APPROVAL_UNDONE"])
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (data.action_type === "approved") q = q.eq("action", "TOURNAMENT_APPROVED");
    if (data.action_type === "rejected") q = q.eq("action", "TOURNAMENT_REJECTED");
    if (data.date_from) q = q.gte("created_at", data.date_from);
    if (data.date_to) q = q.lte("created_at", data.date_to + "T23:59:59Z");

    const { data: logs, count, error } = await q;
    if (error) failDb(error);

    const tournamentIds = Array.from(
      new Set((logs ?? []).filter((l: any) => l.target_id).map((l: any) => l.target_id as string)),
    );
    const { data: tournaments } = tournamentIds.length
      ? await admin
          .from("tournaments")
          .select("id, tournament_date, game_id, store_id, status, stores(name, city), games(name)")
          .in("id", tournamentIds)
      : { data: [] as any[] };
    const tournamentMap = new Map((tournaments ?? []).map((t: any) => [t.id, t]));

    return {
      total: count ?? 0,
      page,
      entries: (logs ?? []).map((log: any) => {
        const t: any = tournamentMap.get(log.target_id);
        return {
          id: log.id,
          action: log.action,
          created_at: log.created_at,
          reason: log.metadata?.reason ?? null,
          tournament_id: log.target_id,
          tournament_date: t?.tournament_date ?? null,
          game_name: t?.games?.name ?? "—",
          store_name: t?.stores?.name ?? "—",
          store_city: t?.stores?.city ?? "—",
          tournament_status: t?.status ?? null,
        };
      }),
    };
  });

export const getManagerCalendar = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { game_id?: string; week_start?: string }) =>
    z
      .object({
        game_id: z.string().uuid().optional(),
        week_start: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    // Determine which game_ids to query
    let gameIds: string[];
    if (data.game_id) {
      if (player.role !== "admin") {
        await assertManagerOwnsGame(admin, player, data.game_id);
      }
      gameIds = [data.game_id];
    } else {
      gameIds = await getManagerGameIds(admin, player);
    }

    // Calculate week range Mon-Sun
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

    if (gameIds.length === 0) {
      return {
        week_start: mondayStr,
        week_end: sundayStr,
        entries: [],
        stats: {
          total_overdue: 0,
          uploaded_so_far: 0,
          days_elapsed: 0,
          total_expected: 0,
          today_expected: 0,
          today_submitted: 0,
        },
      };
    }

    // Get all store schedules for these games
    const { data: schedules, error: se } = await admin
      .from("store_schedules")
      .select(
        "id, store_id, game_id, day_of_week, start_time, stores(id, name, city, state, zone, phone, instagram)",
      )
      .in("game_id", gameIds);
    if (se) failDb(se);

    // Game names
    const { data: gamesData } = await admin.from("games").select("id, name").in("id", gameIds);
    const gameNamesMap = new Map((gamesData ?? []).map((g: any) => [g.id, g.name]));

    // Get organizers for these stores
    const storeIds = Array.from(new Set((schedules ?? []).map((s: any) => s.store_id)));
    const { data: organizers } = storeIds.length
      ? await admin
          .from("players")
          .select("id, geek_tag, home_store_id")
          .eq("role", "organizer")
          .in("home_store_id", storeIds)
      : { data: [] };
    const organizerMap = new Map((organizers ?? []).map((o: any) => [o.home_store_id, o]));

    // Get all tournaments this week for these games
    const { data: weekTournaments } = await admin
      .from("tournaments")
      .select("id, store_id, game_id, tournament_date, status, created_at, rejection_reason")
      .in("game_id", gameIds)
      .gte("tournament_date", mondayStr)
      .lte("tournament_date", sundayStr);

    // Excepciones puntuales (una fecha) al schedule nacional de esta semana —
    // mismo mecanismo que /organizer/calendar usa para ligas internas.
    const scheduleIds = (schedules ?? []).map((s: any) => s.id);
    const { data: overrides } = scheduleIds.length
      ? await admin
          .from("store_schedule_overrides")
          .select("national_schedule_id, occurrence_date, start_time, label")
          .in("national_schedule_id", scheduleIds)
          .gte("occurrence_date", mondayStr)
          .lte("occurrence_date", sundayStr)
      : { data: [] as any[] };
    const overrideByScheduleAndDate = new Map<string, { start_time: string | null; label: string | null }>(
      (overrides ?? []).map((o: any) => [`${o.national_schedule_id}_${o.occurrence_date}`, { start_time: o.start_time, label: o.label }]),
    );

    // Map: storeId-gameId-dayOfWeek -> tournament
    const tournamentMap = new Map<string, any>();
    (weekTournaments ?? []).forEach((t: any) => {
      const d = new Date(t.tournament_date + "T12:00:00");
      const dow = d.getDay();
      tournamentMap.set(`${t.store_id}-${t.game_id}-${dow}`, t);
    });

    const nowMs = Date.now();

    // Build entries
    const entries = (schedules ?? []).map((s: any) => {
      const store = s.stores;
      const organizer = organizerMap.get(s.store_id);
      const tournament = tournamentMap.get(`${s.store_id}-${s.game_id}-${s.day_of_week}`);

      // Actual date for this day_of_week in current week
      // monday = index 0 = day_of_week 1 (Lunes)
      // We need to map day_of_week (0=Sun...6=Sat) to offset from monday
      const offset = s.day_of_week === 0 ? 6 : s.day_of_week - 1;
      const entryDate = new Date(monday);
      entryDate.setDate(monday.getDate() + offset);
      const entryDateStr = toLocalDateStr(entryDate);

      const override = overrideByScheduleAndDate.get(`${s.id}_${entryDateStr}`);
      const effectiveStartTime = override?.start_time || s.start_time;

      // Tournament timing
      const [h, m] = String(effectiveStartTime).split(":").map(Number);
      const tStart = new Date(entryDate);
      tStart.setHours(h, m, 0, 0);
      const tEnd = new Date(tStart);
      tEnd.setHours(h + 3, m, 0, 0);

      const isToday = entryDate.toDateString() === today.toDateString();
      const isPast = entryDate < today && !isToday;
      const isFuture = entryDate > today && !isToday;
      const isOngoing = isToday && nowMs >= tStart.getTime() && nowMs <= tEnd.getTime();
      const hasEnded = isPast || (isToday && nowMs > tEnd.getTime());

      // Report status
      let reportStatus: "submitted" | "overdue" | "pending" | "upcoming";
      const isSubmitted =
        tournament &&
        (tournament.status !== "DRAFT" ||
          (tournament.status === "DRAFT" && !tournament.rejection_reason));
      if (isSubmitted) {
        reportStatus = "submitted";
      } else if (hasEnded && !tournament) {
        reportStatus = "overdue";
      } else if (isFuture) {
        reportStatus = "upcoming";
      } else {
        reportStatus = "pending";
      }

      return {
        id: `${s.store_id}-${s.game_id}-${s.day_of_week}`,
        national_schedule_id: s.id,
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
        start_time: String(effectiveStartTime).slice(0, 5),
        override_label: override?.label ?? null,
        is_override: Boolean(override),
        is_past: isPast,
        is_today: isToday,
        is_future: isFuture,
        is_ongoing: isOngoing,
        has_ended: hasEnded,
        report_status: reportStatus,
        tournament_id: tournament?.id ?? null,
        tournament_status: tournament?.status ?? null,
        organizer_tag: organizer?.geek_tag ?? null,
        organizer_phone: null,
      };
    });

    // Stats
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
        today_submitted: entries.filter((e: any) => e.is_today && e.report_status === "submitted")
          .length,
      },
    };
  });

// ---------- Excepciones puntuales al schedule nacional (una sola fecha) ----------

export const upsertScheduleOverride = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator(
    (d: { national_schedule_id: string; occurrence_date: string; start_time?: string | null; label?: string | null }) =>
      z
        .object({
          national_schedule_id: z.string().uuid(),
          occurrence_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          start_time: z
            .string()
            .regex(/^\d{2}:\d{2}$/)
            .nullable()
            .optional(),
          label: z.string().max(120).nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    const { data: schedule, error: fe } = await admin
      .from("store_schedules")
      .select("store_id, game_id")
      .eq("id", data.national_schedule_id)
      .maybeSingle();
    if (fe) failDb(fe);
    if (!schedule) throw new Error("Horario no encontrado");
    await assertManagerOwnsGame(admin, player, schedule.game_id);

    const { error } = await admin.from("store_schedule_overrides").upsert(
      {
        national_schedule_id: data.national_schedule_id,
        store_id: schedule.store_id,
        occurrence_date: data.occurrence_date,
        start_time: data.start_time || null,
        label: data.label || null,
      },
      { onConflict: "national_schedule_id,occurrence_date" },
    );
    if (error) failDb(error);
    return { ok: true };
  });

export const deleteScheduleOverride = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { national_schedule_id: string; occurrence_date: string }) =>
    z
      .object({
        national_schedule_id: z.string().uuid(),
        occurrence_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    const { data: schedule, error: fe } = await admin
      .from("store_schedules")
      .select("game_id")
      .eq("id", data.national_schedule_id)
      .maybeSingle();
    if (fe) failDb(fe);
    if (!schedule) return { ok: true };
    await assertManagerOwnsGame(admin, player, schedule.game_id);

    const { error } = await admin
      .from("store_schedule_overrides")
      .delete()
      .eq("national_schedule_id", data.national_schedule_id)
      .eq("occurrence_date", data.occurrence_date);
    if (error) failDb(error);
    return { ok: true };
  });

// ==================== Store Schedules (Manager) ====================



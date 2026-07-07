import { failDb } from "./nexus-admin.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireNexusManager, requireNexusAdmin } from "./nexus-auth.middleware";
import { loadTournamentDetail } from "./nexus-tournament-detail.server";
import { logAction, recomputeSnapshot, tfMonth } from "./nexus-admin.functions";

async function getManagerGameIds(
  admin: any,
  player: { id: string; role: string },
): Promise<string[]> {
  if (player.role === "admin") {
    const { data } = await admin.from("games").select("id").eq("is_active", true);
    return (data ?? []).map((g: any) => g.id);
  }
  const { data } = await admin.from("manager_games").select("game_id").eq("player_id", player.id);
  return (data ?? []).map((d: any) => d.game_id);
}

export const getManagerGames = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .handler(async ({ context }) => {
    const { admin, player } = context;
    if (player.role === "admin") {
      const { data } = await admin
        .from("games")
        .select("id, name, slug")
        .eq("is_active", true)
        .order("name", { ascending: true });
      return data ?? [];
    }
    const { data } = await admin
      .from("manager_games")
      .select("game_id, games(id, name, slug)")
      .eq("player_id", player.id);
    return (data ?? []).map((d: any) => d.games).filter(Boolean);
  });

export const getManagerPendingTournaments = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .handler(async ({ context }) => {
    const { admin, player } = context;
    const gameIds = await getManagerGameIds(admin, player);
    if (gameIds.length === 0) return [];

    const { data, error } = await admin
      .from("tournaments")
      .select(
        "id, tournament_date, status, created_at, csv_url, store_id, game_id, stores(name, city, state), games(name)",
      )
      .eq("status", "DRAFT")
      .is("rejection_reason", null)
      .in("game_id", gameIds)
      .order("created_at", { ascending: false });
    if (error) failDb(error);
    return data ?? [];
  });

export const getManagerApprovedTournaments = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .handler(async ({ context }) => {
    const { admin, player } = context;
    const gameIds = await getManagerGameIds(admin, player);
    if (gameIds.length === 0) return [];

    const { data, error } = await admin
      .from("tournaments")
      .select(
        "id, tournament_date, status, approved_at, undo_deadline, csv_url, store_id, game_id, stores(name, city, state), games(name)",
      )
      .eq("status", "APPROVED")
      .in("game_id", gameIds)
      .order("approved_at", { ascending: false });
    if (error) failDb(error);
    return data ?? [];
  });

async function assertManagerOwnsGame(
  admin: any,
  player: { id: string; role: string },
  game_id: string,
) {
  if (player.role === "admin") return;
  const { data: mg } = await admin
    .from("manager_games")
    .select("id")
    .eq("player_id", player.id)
    .eq("game_id", game_id)
    .maybeSingle();
  if (!mg) throw new Error("No tienes permiso para este TCG");
}

export const getManagerTournamentDetail = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { tournament_id: string }) =>
    z.object({ tournament_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: t } = await admin
      .from("tournaments")
      .select("game_id")
      .eq("id", data.tournament_id)
      .maybeSingle();
    if (!t) throw new Error("Torneo no encontrado");
    await assertManagerOwnsGame(admin, player, t.game_id);
    return loadTournamentDetail(admin, data.tournament_id, "/tcg-manager");
  });

export const managerApproveTournament = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { tournament_id: string }) =>
    z.object({ tournament_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: tournament } = await admin
      .from("tournaments")
      .select("game_id, status")
      .eq("id", data.tournament_id)
      .single();
    if (!tournament) throw new Error("Torneo no encontrado");
    if (tournament.status !== "DRAFT")
      throw new Error("Solo se pueden aprobar torneos en estado DRAFT");
    await assertManagerOwnsGame(admin, player, tournament.game_id);

    const now = new Date();
    const undoDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const { error } = await admin
      .from("tournaments")
      .update({
        status: "APPROVED",
        approved_at: now.toISOString(),
        undo_deadline: undoDeadline.toISOString(),
        rejection_reason: null,
        approved_by: player.id,
      })
      .eq("id", data.tournament_id);
    if (error) failDb(error);
    await logAction(
      admin,
      player,
      "TOURNAMENT_APPROVED",
      "tournament",
      data.tournament_id,
      `${tournament.game_id} — ${data.tournament_id}`,
      { approved_by_role: player.role },
    );
    return { success: true };
  });

export const managerRejectTournament = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { tournament_id: string; reason: string }) =>
    z
      .object({
        tournament_id: z.string().uuid(),
        reason: z.string().min(20, "El motivo debe tener al menos 20 caracteres"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: tournament } = await admin
      .from("tournaments")
      .select("game_id, status")
      .eq("id", data.tournament_id)
      .single();
    if (!tournament) throw new Error("Torneo no encontrado");
    await assertManagerOwnsGame(admin, player, tournament.game_id);

    const { error } = await admin
      .from("tournaments")
      .update({
        status: "DRAFT",
        approved_at: null,
        undo_deadline: null,
        rejection_reason: data.reason,
      })
      .eq("id", data.tournament_id);
    if (error) failDb(error);
    await logAction(
      admin,
      player,
      "TOURNAMENT_REJECTED",
      "tournament",
      data.tournament_id,
      `${tournament.game_id} — ${data.tournament_id}`,
      { reason: data.reason, rejected_by_role: player.role },
    );
    return { success: true };
  });

export const managerUndoApproval = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { tournament_id: string }) =>
    z.object({ tournament_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: tournament } = await admin
      .from("tournaments")
      .select("status, undo_deadline, game_id")
      .eq("id", data.tournament_id)
      .single();
    if (!tournament) throw new Error("Torneo no encontrado");
    if (tournament.status !== "APPROVED")
      throw new Error("Solo se pueden deshacer torneos aprobados");
    if (tournament.undo_deadline && new Date(tournament.undo_deadline) < new Date()) {
      throw new Error("La ventana de 48 horas para deshacer ha expirado");
    }
    await assertManagerOwnsGame(admin, player, tournament.game_id);

    const { error } = await admin
      .from("tournaments")
      .update({ status: "DRAFT", approved_at: null, undo_deadline: null })
      .eq("id", data.tournament_id);
    if (error) failDb(error);
    await logAction(
      admin,
      player,
      "APPROVAL_UNDONE",
      "tournament",
      data.tournament_id,
      data.tournament_id,
      {
        undone_by_role: player.role,
      },
    );
    return { success: true };
  });

// Admin-only: list all active games (used by Asignar TCGs modal)
export const listAllGames = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .handler(async ({ context }) => {
    const { admin } = context;
    const { data, error } = await admin
      .from("games")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (error) failDb(error);
    return data ?? [];
  });

// Admin-only: get a manager's currently assigned game ids
export const getManagerAssignedGameIds = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator((d: { player_id: string }) => z.object({ player_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const { data: rows, error } = await admin
      .from("manager_games")
      .select("game_id")
      .eq("player_id", data.player_id);
    if (error) failDb(error);
    return (rows ?? []).map((r: any) => r.game_id as string);
  });

export const assignManagerGames = createServerFn({ method: "POST" })
  .middleware([requireNexusAdmin])
  .inputValidator((d: { player_id: string; game_ids: string[] }) =>
    z
      .object({
        player_id: z.string().uuid(),
        game_ids: z.array(z.string().uuid()),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const { error: de } = await admin
      .from("manager_games")
      .delete()
      .eq("player_id", data.player_id);
    if (de) failDb(de);

    if (data.game_ids.length > 0) {
      const rows = data.game_ids.map((game_id) => ({
        player_id: data.player_id,
        game_id,
      }));
      const { error } = await admin.from("manager_games").insert(rows);
      if (error) failDb(error);
    }
    return { success: true };
  });

// ---------- Badge counts ----------
export const getManagerBadgeCounts = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .handler(async ({ context }) => {
    const { admin, player } = context;

    let gameIds: string[] = [];
    if (player.role === "admin") {
      const { data } = await admin.from("games").select("id").eq("is_active", true);
      gameIds = (data ?? []).map((g: any) => g.id);
    } else {
      const { data } = await admin
        .from("manager_games")
        .select("game_id")
        .eq("player_id", player.id);
      gameIds = (data ?? []).map((d: any) => d.game_id);
    }

    if (gameIds.length === 0) return { pending: 0, approved: 0 };

    const nowIso = new Date().toISOString();
    const [pending, approved] = await Promise.all([
      admin
        .from("tournaments")
        .select("*", { count: "exact", head: true })
        .eq("status", "DRAFT")
        .is("rejection_reason", null)
        .in("game_id", gameIds),
      admin
        .from("tournaments")
        .select("*", { count: "exact", head: true })
        .eq("status", "APPROVED")
        .in("game_id", gameIds)
        .lt("undo_deadline", nowIso),
    ]);

    return {
      pending: pending.count ?? 0,
      approved: approved.count ?? 0,
    };
  });

// ---------- Mi Historial ----------
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
      const day = today.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      monday = new Date(today);
      monday.setDate(today.getDate() + diff);
      monday.setHours(0, 0, 0, 0);
    }
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const mondayStr = monday.toISOString().split("T")[0];
    const sundayStr = sunday.toISOString().split("T")[0];

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
      const entryDateStr = entryDate.toISOString().split("T")[0];

      // Tournament timing
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

// ==================== Store Schedules (Manager) ====================

export const getStoreSchedulesForManager = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { store_id: string }) => z.object({ store_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const gameIds = await getManagerGameIds(admin, player);
    const [schedulesRes, gamesRes] = await Promise.all([
      admin
        .from("store_schedules")
        .select("id, store_id, game_id, day_of_week, start_time, games(id, name)")
        .eq("store_id", data.store_id)
        .in("game_id", gameIds.length ? gameIds : ["00000000-0000-0000-0000-000000000000"])
        .order("game_id")
        .order("day_of_week"),
      admin
        .from("games")
        .select("id, name")
        .eq("is_active", true)
        .in("id", gameIds.length ? gameIds : ["00000000-0000-0000-0000-000000000000"])
        .order("name"),
    ]);
    return {
      schedules: schedulesRes.data ?? [],
      games: gamesRes.data ?? [],
    };
  });

export const upsertStoreScheduleManager = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator(
    (d: {
      store_id: string;
      game_id: string;
      day_of_week: number;
      start_time: string;
      id?: string;
    }) =>
      z
        .object({
          store_id: z.string().uuid(),
          game_id: z.string().uuid(),
          day_of_week: z.number().int().min(0).max(6),
          start_time: z.string().regex(/^\d{2}:\d{2}$/),
          id: z.string().uuid().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const gameIds = await getManagerGameIds(admin, player);
    if (!gameIds.includes(data.game_id)) {
      throw new Error("No tienes permisos para este TCG");
    }
    if (data.id) {
      const { error } = await admin
        .from("store_schedules")
        .update({
          game_id: data.game_id,
          day_of_week: data.day_of_week,
          start_time: data.start_time,
        })
        .eq("id", data.id);
      if (error) failDb(error);
    } else {
      const { error } = await admin.from("store_schedules").upsert(
        {
          store_id: data.store_id,
          game_id: data.game_id,
          day_of_week: data.day_of_week,
          start_time: data.start_time,
        },
        { onConflict: "store_id,game_id,day_of_week" },
      );
      if (error) failDb(error);
    }
    return { success: true };
  });

export const deleteStoreScheduleManager = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { schedule_id: string }) =>
    z.object({ schedule_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: row } = await admin
      .from("store_schedules")
      .select("game_id")
      .eq("id", data.schedule_id)
      .maybeSingle();
    if (!row) throw new Error("Horario no encontrado");
    const gameIds = await getManagerGameIds(admin, player);
    if (!gameIds.includes((row as any).game_id)) {
      throw new Error("No tienes permisos para este TCG");
    }
    const { error } = await admin.from("store_schedules").delete().eq("id", data.schedule_id);
    if (error) failDb(error);
    return { success: true };
  });

// ==================== Unapprove Tournament (Manager) ====================

export const unapproveManagerTournament = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { tournament_id: string; reason: string }) =>
    z
      .object({
        tournament_id: z.string().uuid(),
        reason: z.string().min(10, "El motivo debe tener al menos 10 caracteres"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: t } = await admin
      .from("tournaments")
      .select("status, game_id, store_id, tournament_date")
      .eq("id", data.tournament_id)
      .maybeSingle();
    if (!t || (t as any).status !== "APPROVED") {
      throw new Error("Torneo no válido para des-aprobación");
    }
    await assertManagerOwnsGame(admin, player, (t as any).game_id);
    const { error } = await admin
      .from("tournaments")
      .update({
        status: "DRAFT",
        approved_at: null,
        undo_deadline: null,
        approved_by: null,
        rejection_reason: data.reason,
      })
      .eq("id", data.tournament_id);
    if (error) failDb(error);
    await logAction(
      admin,
      player,
      "TOURNAMENT_REJECTED",
      "tournament",
      data.tournament_id,
      `${(t as any).game_id} — ${(t as any).store_id}`,
      { reason: data.reason, unapproved_by_role: player.role },
    );
    return { success: true };
  });

// ==================== List stores (Manager) ====================

export const listManagerStores = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .handler(async ({ context }) => {
    const { admin } = context;
    const { data } = await admin
      .from("stores")
      .select("id, name, city, state, is_active")
      .order("name");
    return { stores: data ?? [] };
  });

export const getManagerResponsibleStores = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .handler(async ({ context }) => {
    const { admin, player } = context;

    const gameIds = await getManagerGameIds(admin, player);
    if (gameIds.length === 0) return { stores: [], games: [] };

    const { data: schedules } = await admin
      .from("store_schedules")
      .select("store_id, game_id")
      .in("game_id", gameIds);

    const storeIds = Array.from(new Set((schedules ?? []).map((s: any) => s.store_id)));
    if (storeIds.length === 0) return { stores: [], games: [] };

    const { data: stores, error } = await admin
      .from("stores")
      .select(
        "id, name, city, state, country, is_active, address, phone, google_maps_url, description, opening_hours, instagram, website, twitter, twitch, zone",
      )
      .in("id", storeIds)
      .order("name");
    if (error) failDb(error);

    const { data: games } = await admin.from("games").select("id, name").in("id", gameIds);

    const storeGamesMap = new Map<string, string[]>();
    (schedules ?? []).forEach((s: any) => {
      const arr = storeGamesMap.get(s.store_id) ?? [];
      if (!arr.includes(s.game_id)) arr.push(s.game_id);
      storeGamesMap.set(s.store_id, arr);
    });

    return {
      stores: (stores ?? []).map((s: any) => ({
        ...s,
        available_game_ids: storeGamesMap.get(s.id) ?? [],
      })),
      games: games ?? [],
    };
  });

export const updateStoreData = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator(
    (d: {
      store_id: string;
      name: string;
      city?: string;
      state?: string;
      address?: string;
      phone?: string;
      google_maps_url?: string;
      description?: string;
      opening_hours?: string;
      instagram?: string;
      website?: string;
      twitter?: string;
      twitch?: string;
    }) =>
      z
        .object({
          store_id: z.string().uuid(),
          name: z.string().min(1).max(120),
          city: z.string().max(120).optional(),
          state: z.string().max(120).optional(),
          address: z.string().max(300).optional(),
          phone: z.string().max(20).optional(),
          google_maps_url: z.string().max(500).optional(),
          description: z.string().max(500).optional(),
          opening_hours: z.string().max(200).optional(),
          instagram: z.string().max(100).optional(),
          website: z.string().max(200).optional(),
          twitter: z.string().max(100).optional(),
          twitch: z.string().max(100).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    if (player.role !== "admin") {
      const gameIds = await getManagerGameIds(admin, player);
      const { data: schedule } = await admin
        .from("store_schedules")
        .select("id")
        .eq("store_id", data.store_id)
        .in("game_id", gameIds)
        .limit(1)
        .maybeSingle();
      if (!schedule) {
        throw new Error("No tienes permisos sobre esta tienda");
      }
    }

    const { store_id, ...fields } = data;
    const { error } = await admin
      .from("stores")
      .update({
        name: fields.name,
        city: fields.city || null,
        state: fields.state || null,
        address: fields.address || null,
        phone: fields.phone || null,
        google_maps_url: fields.google_maps_url || null,
        description: fields.description || null,
        opening_hours: fields.opening_hours || null,
        instagram: fields.instagram || null,
        website: fields.website || null,
        twitter: fields.twitter || null,
        twitch: fields.twitch || null,
      })
      .eq("id", store_id);
    if (error) failDb(error);

    await logAction(admin, player, "STORE_UPDATED", "store", store_id, fields.name);
    return { ok: true };
  });

export const getManagerPublishedTournaments = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .handler(async ({ context }) => {
    const { admin, player } = context;
    const gameIds = await getManagerGameIds(admin, player);
    if (gameIds.length === 0) return [];

    const { data, error } = await admin
      .from("tournaments")
      .select(
        "id, tournament_date, status, published_at, csv_url, store_id, game_id, stores(name, city, state), games(name)",
      )
      .eq("status", "PUBLISHED")
      .in("game_id", gameIds)
      .order("published_at", { ascending: false });
    if (error) failDb(error);
    return data ?? [];
  });

export const unpublishManagerTournament = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator((d: { tournament_id: string; reason: string }) =>
    z
      .object({
        tournament_id: z.string().uuid(),
        reason: z.string().min(10, "El motivo debe tener al menos 10 caracteres"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: t } = await admin
      .from("tournaments")
      .select(
        "status, game_id, store_id, tournament_date, qualifying_year, qualifying_month, season_id",
      )
      .eq("id", data.tournament_id)
      .maybeSingle();
    if (!t || (t as any).status !== "PUBLISHED") {
      throw new Error("Solo se pueden despublicar torneos en estado Publicado");
    }
    await assertManagerOwnsGame(admin, player, (t as any).game_id);

    const { error } = await admin
      .from("tournaments")
      .update({
        status: "UNPUBLISHED",
        unpublish_reason: data.reason,
        unpublished_at: new Date().toISOString(),
        unpublished_by: player.id,
      } as any)
      .eq("id", data.tournament_id);
    if (error) failDb(error);

    const monthKey = tfMonth((t as any).qualifying_month, (t as any).qualifying_year);
    await recomputeSnapshot(admin, (t as any).game_id, (t as any).store_id, "MONTHLY", monthKey, {
      year: (t as any).qualifying_year,
      month: (t as any).qualifying_month,
    });
    if ((t as any).season_id) {
      const { data: season } = await admin
        .from("seasons")
        .select("slug")
        .eq("id", (t as any).season_id)
        .maybeSingle();
      if ((season as any)?.slug) {
        await recomputeSnapshot(
          admin,
          (t as any).game_id,
          (t as any).store_id,
          "SEMESTRAL",
          (season as any).slug,
          { season_id: (t as any).season_id },
          (t as any).season_id,
        );
      }
    }

    await logAction(
      admin,
      player,
      "TOURNAMENT_UNPUBLISHED",
      "tournament",
      data.tournament_id,
      `${(t as any).game_id} — ${(t as any).store_id}`,
      { reason: data.reason, unpublished_by_role: player.role },
    );
    return { success: true };
  });

// ---------- Historial de Torneos (scoped al manager) ----------
export const getManagerTournamentHistory = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .inputValidator(
    (d: {
      status?: string;
      game_id?: string;
      store_id?: string;
      date_from?: string;
      date_to?: string;
      season_id?: string;
      page?: number;
    }) =>
      z
        .object({
          status: z.string().optional(),
          game_id: z.string().optional(),
          store_id: z.string().optional(),
          date_from: z.string().optional(),
          date_to: z.string().optional(),
          season_id: z.string().optional(),
          page: z.number().min(1).default(1),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const PAGE_SIZE = 25;
    const page = data.page ?? 1;
    const offset = (page - 1) * PAGE_SIZE;

    const managerGameIds = await getManagerGameIds(admin, player);
    if (managerGameIds.length === 0) {
      return { total: 0, page, stats: {}, tournaments: [] };
    }

    const gameIdsFilter = data.game_id
      ? managerGameIds.includes(data.game_id)
        ? [data.game_id]
        : []
      : managerGameIds;

    if (gameIdsFilter.length === 0) {
      return { total: 0, page, stats: {}, tournaments: [] };
    }

    const baseCols =
      "id, tournament_date, status, csv_url, approved_at, published_at, created_at, game_id, store_id";
    const extraCols = ", rejection_reason, approved_by, season_id";

    const build = (cols: string) => {
      let q = admin
        .from("tournaments")
        .select(cols, { count: "exact" })
        .in("game_id", gameIdsFilter)
        .order("tournament_date", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (data.status) q = q.eq("status", data.status);
      if (data.store_id) q = q.eq("store_id", data.store_id);
      if (data.date_from) q = q.gte("tournament_date", data.date_from);
      if (data.date_to) q = q.lte("tournament_date", data.date_to);
      if (data.season_id) q = q.eq("season_id", data.season_id);
      return q;
    };

    let res = await build(baseCols + extraCols);
    if (res.error && /column .* does not exist/i.test(res.error.message)) {
      res = await build(baseCols);
    }
    if (res.error) failDb(res.error);

    const rows = (res.data ?? []) as any[];
    const count = res.count;
    const gameIds = Array.from(new Set(rows.map((r) => r.game_id)));
    const storeIds = Array.from(new Set(rows.map((r) => r.store_id)));
    const approverIds = Array.from(
      new Set(rows.filter((r) => r.approved_by).map((r) => r.approved_by as string)),
    );
    const tournamentIds = rows.map((r) => r.id);

    const [gmsRes, storesRes, approversRes, resultsRes, allStatsRes] = await Promise.all([
      gameIds.length
        ? admin.from("games").select("id, name").in("id", gameIds)
        : Promise.resolve({ data: [] as any[] }),
      storeIds.length
        ? admin.from("stores").select("id, name, city").in("id", storeIds)
        : Promise.resolve({ data: [] as any[] }),
      approverIds.length
        ? admin.from("players").select("id, geek_tag, role").in("id", approverIds)
        : Promise.resolve({ data: [] as any[] }),
      tournamentIds.length
        ? admin
            .from("tournament_results")
            .select("tournament_id")
            .in("tournament_id", tournamentIds)
        : Promise.resolve({ data: [] as any[] }),
      admin.from("tournaments").select("status").in("game_id", gameIdsFilter),
    ]);

    const gamesMap = Object.fromEntries((gmsRes.data ?? []).map((g: any) => [g.id, g.name]));
    const storesMap = Object.fromEntries((storesRes.data ?? []).map((s: any) => [s.id, s]));
    const approversMap = Object.fromEntries((approversRes.data ?? []).map((p: any) => [p.id, p]));
    const participantMap = (resultsRes.data ?? []).reduce((acc: Record<string, number>, r: any) => {
      acc[r.tournament_id] = (acc[r.tournament_id] ?? 0) + 1;
      return acc;
    }, {});
    const globalStats = (allStatsRes.data ?? []).reduce((acc: Record<string, number>, t: any) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      total: count ?? 0,
      page,
      stats: globalStats,
      tournaments: rows.map((r) => {
        const store: any = storesMap[r.store_id];
        const approver: any = r.approved_by ? approversMap[r.approved_by] : null;
        return {
          ...r,
          game_name: gamesMap[r.game_id] ?? "—",
          store_name: store?.name ?? "—",
          store_city: store?.city ?? "—",
          approved_by_tag: approver?.geek_tag ?? null,
          approved_by_role: approver?.role ?? null,
          participants: participantMap[r.id] ?? 0,
        };
      }),
    };
  });

export const getManagerFilterOptions = createServerFn({ method: "POST" })
  .middleware([requireNexusManager])
  .handler(async ({ context }) => {
    const { admin, player } = context;
    const gameIds = await getManagerGameIds(admin, player);

    const [gamesRes, seasonsRes] = await Promise.all([
      gameIds.length
        ? admin.from("games").select("id, name").in("id", gameIds).order("name")
        : Promise.resolve({ data: [] as any[] }),
      admin
        .from("seasons")
        .select("id, name, slug, status")
        .order("start_date", { ascending: false }),
    ]);

    let stores: any[] = [];
    if (gameIds.length) {
      const { data: schedules } = await admin
        .from("store_schedules")
        .select("store_id")
        .in("game_id", gameIds);
      const storeIds = Array.from(new Set((schedules ?? []).map((s: any) => s.store_id)));
      if (storeIds.length) {
        const { data } = await admin
          .from("stores")
          .select("id, name, city")
          .in("id", storeIds)
          .order("city")
          .order("name");
        stores = data ?? [];
      }
    }

    return {
      games: gamesRes.data ?? [],
      stores,
      seasons: seasonsRes.data ?? [],
    };
  });

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
      return { monthly_trend: [], player_classification: [], peak_days: [] };
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
      return { monthly_trend: [], player_classification: [], peak_days: [] };
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
      return { monthly_trend: [], player_classification: [], peak_days: [] };
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

    const player_classification = Array.from(playerDates.entries()).map(([player_id, dates]) => ({
      player_id,
      last_visit: dates[dates.length - 1],
      total_tournaments: dates.length,
    }));

    return { monthly_trend, player_classification, peak_days };
  });

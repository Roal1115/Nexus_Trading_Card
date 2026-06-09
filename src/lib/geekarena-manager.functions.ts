import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  requireGeekarenaManager,
  requireGeekarenaAdmin,
} from "./geekarena-auth.middleware";
import { loadTournamentDetail } from "./geekarena-tournament-detail.server";
import { logAction } from "./geekarena-admin.functions";

async function getManagerGameIds(
  admin: any,
  player: { id: string; role: string },
): Promise<string[]> {
  if (player.role === "admin") {
    const { data } = await admin
      .from("games")
      .select("id")
      .eq("is_active", true);
    return (data ?? []).map((g: any) => g.id);
  }
  const { data } = await admin
    .from("manager_games")
    .select("game_id")
    .eq("player_id", player.id);
  return (data ?? []).map((d: any) => d.game_id);
}

export const getManagerGames = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaManager])
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
    return (data ?? [])
      .map((d: any) => d.games)
      .filter(Boolean);
  });

export const getManagerPendingTournaments = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaManager])
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
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getManagerApprovedTournaments = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaManager])
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
    if (error) throw new Error(error.message);
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
  .middleware([requireGeekarenaManager])
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
  .middleware([requireGeekarenaManager])
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
    if (error) throw new Error(error.message);
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
  .middleware([requireGeekarenaManager])
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
    if (error) throw new Error(error.message);
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
  .middleware([requireGeekarenaManager])
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
    if (
      tournament.undo_deadline &&
      new Date(tournament.undo_deadline) < new Date()
    ) {
      throw new Error("La ventana de 48 horas para deshacer ha expirado");
    }
    await assertManagerOwnsGame(admin, player, tournament.game_id);

    const { error } = await admin
      .from("tournaments")
      .update({ status: "DRAFT", approved_at: null, undo_deadline: null })
      .eq("id", data.tournament_id);
    if (error) throw new Error(error.message);
    await logAction(
      admin,
      player,
      "APPROVAL_UNDONE",
      "tournament",
      data.tournament_id,
      data.tournament_id,
      { undone_by_role: player.role },
    );
    return { success: true };
  });

// Admin-only: list all active games (used by Asignar TCGs modal)
export const listAllGames = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .handler(async ({ context }) => {
    const { admin } = context;
    const { data, error } = await admin
      .from("games")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Admin-only: get a manager's currently assigned game ids
export const getManagerAssignedGameIds = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { player_id: string }) =>
    z.object({ player_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const { data: rows, error } = await admin
      .from("manager_games")
      .select("game_id")
      .eq("player_id", data.player_id);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => r.game_id as string);
  });

export const assignManagerGames = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
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
    if (de) throw new Error(de.message);

    if (data.game_ids.length > 0) {
      const rows = data.game_ids.map((game_id) => ({
        player_id: data.player_id,
        game_id,
      }));
      const { error } = await admin.from("manager_games").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { success: true };
  });

// ---------- Badge counts ----------
export const getManagerBadgeCounts = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaManager])
  .handler(async ({ context }) => {
    const { admin, player } = context;

    let gameIds: string[] = [];
    if (player.role === "admin") {
      const { data } = await admin
        .from("games")
        .select("id")
        .eq("is_active", true);
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
  .middleware([requireGeekarenaManager])
  .inputValidator((d: {
    action_type?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
  }) =>
    z.object({
      action_type: z.string().optional(),
      date_from: z.string().optional(),
      date_to: z.string().optional(),
      page: z.number().min(1).default(1),
    }).parse(d),
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
    if (error) throw new Error(error.message);

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

// ---------- Calendario ----------
async function assertManagerOwnsGameLocal(
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

export const getManagerCalendar = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaManager])
  .inputValidator((d: { game_id: string; week_start?: string }) =>
    z.object({
      game_id: z.string().uuid(),
      week_start: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    if (player.role !== "admin") {
      await assertManagerOwnsGameLocal(admin, player, data.game_id);
    }

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

    const { data: schedules } = await admin
      .from("store_schedules")
      .select(
        "id, store_id, game_id, day_of_week, start_time, is_active, stores(id, name, city, state, zone, phone, instagram)",
      )
      .eq("game_id", data.game_id)
      .eq("is_active", true);

    const storeIds = Array.from(
      new Set((schedules ?? []).map((s: any) => s.store_id)),
    );
    const { data: organizers } = storeIds.length
      ? await admin
          .from("players")
          .select("id, geek_tag, email, home_store_id")
          .eq("role", "organizer")
          .in("home_store_id", storeIds)
      : { data: [] as any[] };
    const organizerMap = new Map(
      (organizers ?? []).map((o: any) => [o.home_store_id, o]),
    );

    const { data: allTournaments } = await admin
      .from("tournaments")
      .select(
        "id, store_id, tournament_date, status, created_at, rejection_reason",
      )
      .eq("game_id", data.game_id)
      .gte("tournament_date", mondayStr)
      .lte("tournament_date", sundayStr);

    const allTournamentMap = new Map<string, any>();
    (allTournaments ?? []).forEach((t: any) => {
      const d = new Date(t.tournament_date + "T12:00:00");
      const dow = d.getDay();
      allTournamentMap.set(`${t.store_id}-${dow}`, t);
    });

    const nowMs = Date.now();
    const todayDateStr = today.toDateString();

    const entries = (schedules ?? []).map((s: any) => {
      const store = s.stores;
      const organizer: any = organizerMap.get(s.store_id);
      const tournament = allTournamentMap.get(`${s.store_id}-${s.day_of_week}`);

      const entryDate = new Date(monday);
      entryDate.setDate(
        monday.getDate() + ((s.day_of_week === 0 ? 7 : s.day_of_week) - 1),
      );
      const entryDateStr = entryDate.toISOString().split("T")[0];

      const [h, m] = String(s.start_time).split(":").map(Number);
      const tournamentStart = new Date(entryDate);
      tournamentStart.setHours(h, m, 0, 0);
      const tournamentEnd = new Date(tournamentStart);
      tournamentEnd.setHours(h + 3, m, 0, 0);

      const isPast =
        entryDate < today && entryDate.toDateString() !== todayDateStr;
      const isToday = entryDate.toDateString() === todayDateStr;
      const isFuture = entryDate > today && !isToday;
      const isOngoing =
        isToday &&
        nowMs >= tournamentStart.getTime() &&
        nowMs <= tournamentEnd.getTime();
      const hasEnded =
        isPast || (isToday && nowMs > tournamentEnd.getTime());

      let reportStatus: "submitted" | "overdue" | "pending" | "upcoming";
      if (tournament && tournament.status !== "DRAFT") {
        reportStatus = "submitted";
      } else if (
        tournament &&
        tournament.status === "DRAFT" &&
        !tournament.rejection_reason
      ) {
        reportStatus = "submitted";
      } else if (hasEnded && !tournament) {
        reportStatus = "overdue";
      } else if (isFuture) {
        reportStatus = "upcoming";
      } else {
        reportStatus = "pending";
      }

      return {
        id: `${s.store_id}-${s.day_of_week}`,
        store_id: s.store_id,
        store_name: store?.name ?? "—",
        city: store?.city ?? "—",
        zone: store?.zone ?? "Zona Extendida",
        phone: store?.phone ?? null,
        instagram: store?.instagram ?? null,
        day_of_week: s.day_of_week,
        date: entryDateStr,
        start_time: s.start_time,
        is_past: isPast,
        is_today: isToday,
        is_future: isFuture,
        is_ongoing: isOngoing,
        has_ended: hasEnded,
        report_status: reportStatus,
        tournament_id: tournament?.id ?? null,
        tournament_status: tournament?.status ?? null,
        organizer_tag: organizer?.geek_tag ?? null,
        organizer_phone: organizer?.email ?? null,
      };
    });

    const totalExpected = entries.length;
    const totalSubmitted = entries.filter(
      (e) => e.report_status === "submitted",
    ).length;
    const totalOverdue = entries.filter(
      (e) => e.report_status === "overdue",
    ).length;
    const todayExpected = entries.filter((e) => e.is_today).length;
    const todaySubmitted = entries.filter(
      (e) => e.is_today && e.report_status === "submitted",
    ).length;
    const daysElapsed = entries.filter((e) => !e.is_future).length;
    const uploadedSoFar = entries.filter(
      (e) => !e.is_future && e.report_status === "submitted",
    ).length;

    return {
      week_start: mondayStr,
      week_end: sundayStr,
      entries,
      stats: {
        total_overdue: totalOverdue,
        total_submitted: totalSubmitted,
        uploaded_so_far: uploadedSoFar,
        days_elapsed: daysElapsed,
        total_expected: totalExpected,
        today_expected: todayExpected,
        today_submitted: todaySubmitted,
      },
    };
  });

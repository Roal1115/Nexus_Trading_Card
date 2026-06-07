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

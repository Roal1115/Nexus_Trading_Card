import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  requireGeekarenaManager,
  requireGeekarenaAdmin,
} from "./geekarena-auth.middleware";
import { loadTournamentDetail } from "./geekarena-tournament-detail.server";

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
      })
      .eq("id", data.tournament_id);
    if (error) throw new Error(error.message);
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

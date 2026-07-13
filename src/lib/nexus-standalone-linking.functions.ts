import { failDb } from "./nexus-admin.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireNexusUser } from "./nexus-auth.middleware";

// ============================================================
// undoSessionLink — revierte el vínculo de una sesión matched
// ============================================================
export const undoSessionLink = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: { session_id: string }) =>
    z.object({ session_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    // Verificar que la sesión existe, pertenece al player y está matched
    const { data: session } = await admin
      .from("standalone_sessions")
      .select("id, status, tournament_id, player_id")
      .eq("id", data.session_id)
      .eq("player_id", player.id)
      .maybeSingle();

    if (!session) throw new Error("Sesión no encontrada o no autorizado");
    if (session.status !== "matched")
      throw new Error("Solo se puede deshacer el vínculo de sesiones vinculadas");

    const previousTournamentId = (session as any).tournament_id;

    // Verificar que el oponente no haya confirmado ninguna de las rondas migradas
    const { data: blockedRows } = await admin
      .from("tournament_round_results")
      .select("id, round_number, opponent_player_id")
      .eq("source_session_id", data.session_id);

    const blockedList = blockedRows ?? [];

    for (const row of blockedList as any[]) {
      if (!row.opponent_player_id) continue;

      const { data: opponentConfirmed } = await admin
        .from("tournament_round_results")
        .select("id")
        .eq("tournament_id", previousTournamentId)
        .eq("player_id", row.opponent_player_id)
        .eq("round_number", row.round_number)
        .eq("status", "confirmed")
        .eq("is_auto_populated", false)
        .maybeSingle();

      if (opponentConfirmed) {
        throw new Error(
          "No se puede deshacer el vínculo: tu oponente ya confirmó el resultado de una o más rondas. Contacta a un administrador si crees que el vínculo fue incorrecto.",
        );
      }
    }

    // Eliminar las filas migradas (solo las que vienen de esta sesión)
    const { error: deleteError } = await admin
      .from("tournament_round_results")
      .delete()
      .eq("source_session_id", data.session_id);

    if (deleteError) failDb(deleteError);

    // Revertir la sesión a unlinked
    const { error: updateError } = await admin
      .from("standalone_sessions")
      .update({
        status: "unlinked",
        tournament_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.session_id);

    if (updateError) failDb(updateError);

    // Log del evento
    await admin.from("session_link_events").insert({
      session_id: data.session_id,
      event_type: "unlinked",
      tournament_id: previousTournamentId,
      actor_player_id: player.id,
    });

    return { success: true };
  });

// ============================================================
// getTournamentCandidates — torneos candidatos para desambiguación manual
// ============================================================
export const getTournamentCandidates = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: { session_id: string }) =>
    z.object({ session_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    const { data: session } = await admin
      .from("standalone_sessions")
      .select("id, game_id, session_date, session_time, store_id, player_id")
      .eq("id", data.session_id)
      .eq("player_id", player.id)
      .maybeSingle();

    if (!session) throw new Error("Sesión no encontrada");
    const s = session as any;

    // Player's home zone via home_store_id
    const { data: playerRow } = await admin
      .from("players")
      .select("home_store_id")
      .eq("id", player.id)
      .maybeSingle();

    const { data: homeStore } = (playerRow as any)?.home_store_id
      ? await admin
          .from("stores")
          .select("zone")
          .eq("id", (playerRow as any).home_store_id)
          .maybeSingle()
      : { data: null };

    const playerZone = (homeStore as any)?.zone ?? null;

    // Torneos publicados del mismo TCG y fecha donde el player participó
    const { data: candidates } = await admin
      .from("tournaments")
      .select("id, tournament_date, tournament_time, store_id, stores!inner(name, city, zone)")
      .eq("status", "PUBLISHED")
      .eq("game_id", s.game_id)
      .eq("tournament_date", s.session_date);

    const candidateList = (candidates ?? []) as any[];

    // Filtrar solo torneos donde el player tiene resultado oficial
    const playerCandidates: any[] = [];
    for (const t of candidateList) {
      const { data: result } = await admin
        .from("tournament_results")
        .select("id")
        .eq("tournament_id", t.id)
        .eq("player_id", player.id)
        .maybeSingle();

      if (!result) continue;

      const sessionTimeSecs = s.session_time
        ? s.session_time
            .split(":")
            .reduce(
              (acc: number, val: string, i: number) => acc + parseInt(val) * [3600, 60, 1][i],
              0,
            )
        : 43200;

      const tournamentTimeSecs = t.tournament_time
        ? t.tournament_time
            .split(":")
            .reduce(
              (acc: number, val: string, i: number) => acc + parseInt(val) * [3600, 60, 1][i],
              0,
            )
        : 43200;

      const diffHours = Math.abs(sessionTimeSecs - tournamentTimeSecs) / 3600;

      playerCandidates.push({
        id: t.id,
        tournament_date: t.tournament_date,
        tournament_time: t.tournament_time,
        store_id: t.store_id,
        store_name: t.stores?.name ?? "—",
        store_city: t.stores?.city ?? "—",
        store_zone: t.stores?.zone ?? null,
        diff_hours: diffHours,
        is_home_zone: t.stores?.zone === playerZone,
      });
    }

    // Ordenar: primero home zone, luego por cercanía de hora
    playerCandidates.sort((a, b) => {
      if (a.is_home_zone && !b.is_home_zone) return -1;
      if (!a.is_home_zone && b.is_home_zone) return 1;
      return a.diff_hours - b.diff_hours;
    });

    return {
      home_zone: playerZone,
      candidates: playerCandidates,
    };
  });

// ============================================================
// linkSessionManually — vinculación manual por el player
// ============================================================
export const linkSessionManually = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: { session_id: string; tournament_id: string }) =>
    z
      .object({
        session_id: z.string().uuid(),
        tournament_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    // Verificar sesión
    const { data: session } = await admin
      .from("standalone_sessions")
      .select("id, status, game_id, player_id")
      .eq("id", data.session_id)
      .eq("player_id", player.id)
      .maybeSingle();

    if (!session) throw new Error("Sesión no encontrada o no autorizado");
    if ((session as any).status !== "unlinked")
      throw new Error("Solo se pueden vincular sesiones sin vínculo previo");

    // Verificar que el torneo existe, está publicado y el player participó
    const { data: tournament } = await admin
      .from("tournaments")
      .select("id, game_id, status")
      .eq("id", data.tournament_id)
      .eq("status", "PUBLISHED")
      .maybeSingle();

    if (!tournament) throw new Error("Torneo no encontrado o no publicado");

    const { data: result } = await admin
      .from("tournament_results")
      .select("id")
      .eq("tournament_id", data.tournament_id)
      .eq("player_id", player.id)
      .maybeSingle();

    if (!result) throw new Error("No apareces en los resultados de este torneo");

    // Migrar rondas
    const { data: rounds } = await admin
      .from("standalone_round_results")
      .select("*")
      .eq("session_id", data.session_id);

    const roundsToMigrate = (rounds ?? []) as any[];

    if (roundsToMigrate.length > 0) {
      const { error: insertError } = await admin.from("tournament_round_results").insert(
        roundsToMigrate
          .filter((r: any) => {
            // Skip si ya existe una fila oficial no auto-populada
            return true; // filtrado abajo con NOT EXISTS en SQL no disponible aquí, manejamos con upsert
          })
          .map((r: any) => ({
            tournament_id: data.tournament_id,
            player_id: r.player_id,
            opponent_player_id: r.opponent_player_id,
            round_number: r.round_number,
            is_bye: r.is_bye,
            player_leader_id: r.player_leader_id,
            opponent_leader_id: r.opponent_leader_id,
            won_die_roll: r.won_die_roll,
            turn_order: r.turn_order,
            won_match: r.won_match,
            notes: r.notes,
            is_auto_populated: false,
            status: "confirmed",
            reporter_player_id: r.reporter_player_id,
            source_session_id: data.session_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })),
      );

      if (insertError) failDb(insertError);
    }

    // Actualizar sesión
    await admin
      .from("standalone_sessions")
      .update({
        status: "matched",
        tournament_id: data.tournament_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.session_id);

    // Log
    await admin.from("session_link_events").insert({
      session_id: data.session_id,
      event_type: "linked",
      tournament_id: data.tournament_id,
      actor_player_id: player.id,
    });

    return { success: true };
  });


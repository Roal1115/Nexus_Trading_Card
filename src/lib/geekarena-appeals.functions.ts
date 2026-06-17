import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireGeekarenaUser } from "./geekarena-auth.middleware";

const turnOrderSchema = z.enum(["first", "second"]).nullable().optional();

// ============================================================
// createAppeal — jugador apela una ronda auto-poblada
// ============================================================
export const createAppeal = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
  .inputValidator((d: {
    round_id: string;
    proposed_player_leader_id?: string | null;
    proposed_opponent_leader_id?: string | null;
    proposed_won_match?: boolean | null;
    proposed_won_die_roll?: boolean | null;
    proposed_turn_order?: "first" | "second" | null;
  }) =>
    z
      .object({
        round_id: z.string().uuid(),
        proposed_player_leader_id: z.string().uuid().nullable().optional(),
        proposed_opponent_leader_id: z.string().uuid().nullable().optional(),
        proposed_won_match: z.boolean().nullable().optional(),
        proposed_won_die_roll: z.boolean().nullable().optional(),
        proposed_turn_order: turnOrderSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    const { data: round } = await admin
      .from("tournament_round_results")
      .select(
        "id, tournament_id, player_id, round_number, is_auto_populated, player_leader_id, opponent_leader_id, won_match, won_die_roll, turn_order",
      )
      .eq("id", data.round_id)
      .single();

    if (!round) throw new Error("Ronda no encontrada");
    if (round.player_id !== player.id) throw new Error("No puedes apelar una ronda que no es tuya");
    if (!round.is_auto_populated) throw new Error("Solo se pueden apelar rondas autopobladas por tu oponente");

    // Cooldown: 24h desde el último intento de apelación sobre esta misma ronda
    const { data: lastAppeal } = await admin
      .from("round_appeals")
      .select("created_at")
      .eq("original_round_id", data.round_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastAppeal) {
      const hoursSince = (Date.now() - new Date(lastAppeal.created_at).getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        const hoursLeft = Math.ceil(24 - hoursSince);
        throw new Error(`Debes esperar ${hoursLeft} hora(s) más antes de volver a apelar esta ronda`);
      }
    }

    const { data: tournament } = await admin
      .from("tournaments")
      .select("store_id")
      .eq("id", round.tournament_id)
      .single();
    if (!tournament) throw new Error("Torneo no encontrado");

    const { error: insertError } = await admin.from("round_appeals").insert({
      tournament_id: round.tournament_id,
      original_round_id: round.id,
      appellant_player_id: player.id,
      store_id: tournament.store_id,
      round_number: round.round_number,
      original_player_leader_id: round.player_leader_id,
      original_opponent_leader_id: round.opponent_leader_id,
      original_won_match: round.won_match,
      original_won_die_roll: round.won_die_roll,
      original_turn_order: round.turn_order,
      proposed_player_leader_id: data.proposed_player_leader_id ?? null,
      proposed_opponent_leader_id: data.proposed_opponent_leader_id ?? null,
      proposed_won_match: data.proposed_won_match ?? null,
      proposed_won_die_roll: data.proposed_won_die_roll ?? null,
      proposed_turn_order: data.proposed_turn_order ?? null,
      status: "pending",
    });
    if (insertError) {
      // Si ya existe una apelación pendiente (UNIQUE constraint), dar mensaje claro
      if (insertError.message.includes("duplicate") || insertError.message.includes("unique")) {
        throw new Error("Ya existe una apelación en revisión para esta ronda");
      }
      throw new Error(insertError.message);
    }

    const { error: updateError } = await admin
      .from("tournament_round_results")
      .update({ status: "under_appeal" })
      .eq("id", round.id);
    if (updateError) throw new Error(updateError.message);

    return { success: true };
  });

// ============================================================
// getStoreAppeals — organizador ve apelaciones pendientes de su tienda
// ============================================================
export const getStoreAppeals = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
  .handler(async ({ context }) => {
    const { admin, player } = context;

    if (!player.home_store_id) return { appeals: [] };

    const { data: appeals } = await admin
      .from("round_appeals")
      .select(
        "id, tournament_id, original_round_id, appellant_player_id, round_number, original_player_leader_id, original_opponent_leader_id, original_won_match, original_won_die_roll, original_turn_order, proposed_player_leader_id, proposed_opponent_leader_id, proposed_won_match, proposed_won_die_roll, proposed_turn_order, created_at",
      )
      .eq("store_id", player.home_store_id)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (!appeals || appeals.length === 0) return { appeals: [] };

    // Resolver nombres de jugadores y leaders involucrados
    const roundIds = appeals.map((a: any) => a.original_round_id);
    const { data: rounds } = await admin
      .from("tournament_round_results")
      .select("id, player_id, opponent_player_id")
      .in("id", roundIds);
    const roundMap = new Map((rounds ?? []).map((r: any) => [r.id, r]));

    const playerIds = Array.from(
      new Set(
        appeals.flatMap((a: any) => {
          const r = roundMap.get(a.original_round_id);
          return [a.appellant_player_id, r?.player_id, r?.opponent_player_id].filter(Boolean);
        }),
      ),
    );
    const { data: players } = playerIds.length
      ? await admin.from("players").select("id, geek_tag").in("id", playerIds)
      : { data: [] as any[] };
    const playerMap = new Map((players ?? []).map((p: any) => [p.id, p.geek_tag]));

    const leaderIds = Array.from(
      new Set(
        appeals
          .flatMap((a: any) => [
            a.original_player_leader_id,
            a.original_opponent_leader_id,
            a.proposed_player_leader_id,
            a.proposed_opponent_leader_id,
          ])
          .filter(Boolean),
      ),
    );
    const { data: leaders } = leaderIds.length
      ? await admin.from("deck_identifiers").select("id, base_name, card_image").in("id", leaderIds)
      : { data: [] as any[] };
    const leaderMap = new Map((leaders ?? []).map((l: any) => [l.id, l]));

    const tournamentIds = Array.from(new Set(appeals.map((a: any) => a.tournament_id)));
    const { data: tournaments } = tournamentIds.length
      ? await admin.from("tournaments").select("id, tournament_date").in("id", tournamentIds)
      : { data: [] as any[] };
    const tournamentMap = new Map((tournaments ?? []).map((t: any) => [t.id, t.tournament_date]));

    const shaped = appeals.map((a: any) => {
      const r = roundMap.get(a.original_round_id);
      const originalReporterId = r?.opponent_player_id; // quien reportó (el otro jugador)
      return {
        id: a.id,
        tournament_id: a.tournament_id,
        tournament_date: tournamentMap.get(a.tournament_id) ?? null,
        round_number: a.round_number,
        appellant_tag: playerMap.get(a.appellant_player_id) ?? "—",
        original_reporter_tag: originalReporterId ? playerMap.get(originalReporterId) ?? "—" : "—",
        original: {
          player_leader: a.original_player_leader_id ? leaderMap.get(a.original_player_leader_id) ?? null : null,
          opponent_leader: a.original_opponent_leader_id ? leaderMap.get(a.original_opponent_leader_id) ?? null : null,
          won_match: a.original_won_match,
          won_die_roll: a.original_won_die_roll,
          turn_order: a.original_turn_order,
        },
        proposed: {
          player_leader: a.proposed_player_leader_id ? leaderMap.get(a.proposed_player_leader_id) ?? null : null,
          opponent_leader: a.proposed_opponent_leader_id ? leaderMap.get(a.proposed_opponent_leader_id) ?? null : null,
          won_match: a.proposed_won_match,
          won_die_roll: a.proposed_won_die_roll,
          turn_order: a.proposed_turn_order,
        },
        created_at: a.created_at,
      };
    });

    return { appeals: shaped };
  });

// ============================================================
// resolveAppeal — organizador acepta versión original o propuesta
// ============================================================
export const resolveAppeal = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
  .inputValidator((d: { appeal_id: string; resolution: "accepted_original" | "accepted_proposed" }) =>
    z
      .object({
        appeal_id: z.string().uuid(),
        resolution: z.enum(["accepted_original", "accepted_proposed"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    if (player.role !== "organizer" && player.role !== "admin") {
      throw new Error("No tienes permiso para resolver apelaciones");
    }

    const { data: appeal } = await admin
      .from("round_appeals")
      .select("*")
      .eq("id", data.appeal_id)
      .eq("status", "pending")
      .single();
    if (!appeal) throw new Error("Apelación no encontrada o ya resuelta");

    if (player.role === "organizer" && player.home_store_id !== appeal.store_id) {
      throw new Error("Esta apelación no corresponde a tu tienda");
    }

    const updatePayload: Record<string, unknown> = { status: "confirmed" };
    if (data.resolution === "accepted_proposed") {
      updatePayload.player_leader_id = appeal.proposed_player_leader_id;
      updatePayload.opponent_leader_id = appeal.proposed_opponent_leader_id;
      updatePayload.won_match = appeal.proposed_won_match;
      updatePayload.won_die_roll = appeal.proposed_won_die_roll;
      updatePayload.turn_order = appeal.proposed_turn_order;
    }

    const { error: updateError } = await admin
      .from("tournament_round_results")
      .update(updatePayload)
      .eq("id", appeal.original_round_id);
    if (updateError) throw new Error(updateError.message);

    const { error: resolveError } = await admin
      .from("round_appeals")
      .update({
        status: "resolved",
        resolution: data.resolution,
        resolved_by: player.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", data.appeal_id);
    if (resolveError) throw new Error(resolveError.message);

    return { success: true };
  });

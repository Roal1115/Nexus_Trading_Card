import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireGeekarenaUser } from "./geekarena-auth.middleware";

const EXCLUDED_EVENT_LEADER_IDS = ["P-900", "P-800", "P-700"];

function groupOrder(cardSetId: string): number {
  if (cardSetId.startsWith("OP")) return 0;
  if (cardSetId.startsWith("ST")) return 1;
  return 2; // P, EB, PRB, etc.
}

// ============================================================
// getDeckIdentifiers — búsqueda de leaders para el dropdown
// ============================================================
export const getDeckIdentifiers = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
  .inputValidator((d: { game_id: string; search?: string; basic_only?: boolean; card_set_id?: string }) =>
    z
      .object({
        game_id: z.string().uuid(),
        search: z.string().max(100).optional(),
        basic_only: z.boolean().optional(),
        card_set_id: z.string().max(20).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    let q = admin
      .from("deck_identifiers")
      .select("id, card_name, base_name, colors, card_image, card_image_id, set_code, card_set_id")
      .eq("game_id", data.game_id)
      .eq("is_active", true)
      .not("card_set_id", "in", `(${EXCLUDED_EVENT_LEADER_IDS.join(",")})`);

    if (data.card_set_id) {
      // Búsqueda exacta de variantes de UNA carta específica (mismo card_set_id)
      q = q.eq("card_set_id", data.card_set_id);
    } else if (data.search && data.search.trim().length > 0) {
      q = q.ilike("base_name", `%${data.search.trim()}%`);
    }

    const limit = data.search && data.search.trim().length > 0 ? 100 : 800;
    const { data: rows, error } = await q.limit(limit);
    if (error) throw new Error(error.message);

    // basic_only no aplica cuando se busca por card_set_id exacto (queremos TODAS sus variantes)
    const basicOnly = data.card_set_id ? false : (data.basic_only ?? true);
    const filtered = basicOnly
      ? (rows ?? []).filter((r: any) => r.card_image_id === r.card_set_id)
      : (rows ?? []);

    // Orden: grupo (OP < ST < P) → dentro de cada grupo, card_set_id descendente (más reciente arriba)
    return filtered.sort((a: any, b: any) => {
      const groupDiff = groupOrder(a.card_set_id) - groupOrder(b.card_set_id);
      if (groupDiff !== 0) return groupDiff;
      return b.card_set_id.localeCompare(a.card_set_id);
    });
  });

// ============================================================
// getTournamentRoundsForPlayer — rondas guardadas + oponentes disponibles
// ============================================================
export const getTournamentRoundsForPlayer = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
  .inputValidator((d: { tournament_id: string }) =>
    z.object({ tournament_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    const { data: tournament } = await admin
      .from("tournaments")
      .select("id, game_id, tournament_date, store_id")
      .eq("id", data.tournament_id)
      .single();
    if (!tournament) throw new Error("Torneo no encontrado");

    const { data: store } = tournament.store_id
      ? await admin.from("stores").select("name").eq("id", tournament.store_id).maybeSingle()
      : { data: null as { name: string } | null };

    const { data: results } = await admin
      .from("tournament_results")
      .select("player_id, match_points, rank")
      .eq("tournament_id", data.tournament_id);

    const maxMatchPoints = Math.max(0, ...(results ?? []).map((r: any) => r.match_points ?? 0));
    const maxRounds = maxMatchPoints > 0 ? Math.floor(maxMatchPoints / 3) : 0;

    const opponentIds = (results ?? [])
      .map((r: any) => r.player_id)
      .filter((id: string) => id !== player.id);

    const { data: opponents } = opponentIds.length
      ? await admin
          .from("players")
          .select("id, geek_tag")
          .in("id", opponentIds)
          .order("geek_tag", { ascending: true })
      : { data: [] as Array<{ id: string; geek_tag: string }> };

    const { data: myRounds } = await admin
      .from("tournament_round_results")
      .select(
        "id, round_number, is_bye, opponent_player_id, player_leader_id, opponent_leader_id, won_die_roll, turn_order, won_match, notes, is_auto_populated, status",
      )
      .eq("tournament_id", data.tournament_id)
      .eq("player_id", player.id)
      .order("round_number", { ascending: true });

    const leaderIds = Array.from(
      new Set(
        (myRounds ?? [])
          .flatMap((r: any) => [r.player_leader_id, r.opponent_leader_id])
          .filter((id: string | null): id is string => !!id),
      ),
    );

    const { data: leaderRows } = leaderIds.length
      ? await admin
          .from("deck_identifiers")
          .select("id, card_name, base_name, colors, card_image, card_image_id, set_code, card_set_id")
          .in("id", leaderIds)
      : { data: [] as any[] };

    const leaderMap = new Map((leaderRows ?? []).map((l: any) => [l.id, l]));

    const roundsWithLeaders = (myRounds ?? []).map((r: any) => ({
      ...r,
      player_leader: r.player_leader_id ? leaderMap.get(r.player_leader_id) ?? null : null,
      opponent_leader: r.opponent_leader_id ? leaderMap.get(r.opponent_leader_id) ?? null : null,
    }));

    const myLeaderId = roundsWithLeaders.find(
      (r: any) => !r.is_auto_populated && r.player_leader_id,
    )?.player_leader_id;
    const myTournamentLeader = myLeaderId ? leaderMap.get(myLeaderId) ?? null : null;

    const rankMap = new Map((results ?? []).map((r: any) => [r.player_id, r.rank]));

    const completedRounds = roundsWithLeaders.filter((r: any) => !r.is_bye && r.won_match !== null);
    const wins = completedRounds.filter((r: any) => r.won_match === true).length;
    const losses = completedRounds.filter((r: any) => r.won_match === false).length;
    const byeWins = roundsWithLeaders.filter((r: any) => r.is_bye && r.won_match === true).length;
    const totalWins = wins + byeWins;
    const totalPlayed = completedRounds.length + roundsWithLeaders.filter((r: any) => r.is_bye).length;
    const winRate = totalPlayed > 0 ? Math.round((totalWins / totalPlayed) * 100) : null;

    let toughestOpponent: { player_id: string; rank: number } | null = null;
    for (const r of roundsWithLeaders) {
      if (r.is_bye || !r.opponent_player_id) continue;
      const oppRank = rankMap.get(r.opponent_player_id);
      if (oppRank == null) continue;
      if (!toughestOpponent || oppRank < toughestOpponent.rank) {
        toughestOpponent = { player_id: r.opponent_player_id, rank: oppRank };
      }
    }
    const toughestOpponentTag = toughestOpponent
      ? (opponents ?? []).find((o: any) => o.id === toughestOpponent!.player_id)?.geek_tag ?? null
      : null;

    const summary = {
      store_name: (store as any)?.name ?? null,
      tournament_date: tournament.tournament_date,
      wins: totalWins,
      losses,
      win_rate: winRate,
      toughest_opponent_tag: toughestOpponentTag,
      toughest_opponent_rank: toughestOpponent?.rank ?? null,
    };

    return {
      game_id: tournament.game_id,
      max_rounds: maxRounds,
      opponents: opponents ?? [],
      rounds: roundsWithLeaders,
      my_tournament_leader: myTournamentLeader,
      summary,
    };
  });

async function validateMaxWins(
  admin: any,
  tournamentId: string,
  playerId: string,
  roundNumberBeingSaved: number,
  willBeWin: boolean,
) {
  if (!willBeWin) return;

  const { data: myResult } = await admin
    .from("tournament_results")
    .select("match_points")
    .eq("tournament_id", tournamentId)
    .eq("player_id", playerId)
    .maybeSingle();

  const matchPoints = myResult?.match_points ?? 0;
  const maxWins = Math.floor(matchPoints / 3);

  const { data: existingWins } = await admin
    .from("tournament_round_results")
    .select("round_number, won_match, is_bye")
    .eq("tournament_id", tournamentId)
    .eq("player_id", playerId)
    .eq("won_match", true)
    .neq("round_number", roundNumberBeingSaved);

  const currentWinCount = (existingWins ?? []).length;

  if (currentWinCount + 1 > maxWins) {
    throw new Error(
      `No puedes registrar más de ${maxWins} victorias en este torneo (tuviste ${matchPoints} puntos de match). Revisa tus rondas guardadas.`,
    );
  }
}

// ============================================================
// saveRoundResult — guarda una ronda + auto-pobla la fila espejo del oponente
// ============================================================
const turnOrderSchema = z.enum(["first", "second"]).nullable().optional();

export const saveRoundResult = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
  .inputValidator((d: {
    tournament_id: string;
    round_number: number;
    is_bye: boolean;
    opponent_player_id?: string | null;
    player_leader_id?: string | null;
    opponent_leader_id?: string | null;
    won_die_roll?: boolean | null;
    turn_order?: "first" | "second" | null;
    won_match?: boolean | null;
    notes?: string | null;
  }) =>
    z
      .object({
        tournament_id: z.string().uuid(),
        round_number: z.number().int().min(1).max(10),
        is_bye: z.boolean(),
        opponent_player_id: z.string().uuid().nullable().optional(),
        player_leader_id: z.string().uuid().nullable().optional(),
        opponent_leader_id: z.string().uuid().nullable().optional(),
        won_die_roll: z.boolean().nullable().optional(),
        turn_order: turnOrderSchema,
        won_match: z.boolean().nullable().optional(),
        notes: z.string().max(1000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    if (!data.is_bye && !data.opponent_player_id) {
      throw new Error("Debes seleccionar un oponente o marcar Bye");
    }

    const wonMatch = data.is_bye ? true : (data.won_match ?? null);

    await validateMaxWins(admin, data.tournament_id, player.id, data.round_number, wonMatch === true);

    const myRow = {
      tournament_id: data.tournament_id,
      reporter_player_id: player.id,
      player_id: player.id,
      opponent_player_id: data.is_bye ? null : data.opponent_player_id,
      round_number: data.round_number,
      is_bye: data.is_bye,
      player_leader_id: data.player_leader_id ?? null,
      opponent_leader_id: data.is_bye ? null : (data.opponent_leader_id ?? null),
      won_die_roll: data.is_bye ? null : (data.won_die_roll ?? null),
      turn_order: data.is_bye ? null : (data.turn_order ?? null),
      won_match: wonMatch,
      notes: data.notes ?? null,
      is_auto_populated: false,
      status: "confirmed" as const,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await admin
      .from("tournament_round_results")
      .select("id")
      .eq("tournament_id", data.tournament_id)
      .eq("player_id", player.id)
      .eq("round_number", data.round_number)
      .maybeSingle();

    if (existing) {
      const { error } = await admin
        .from("tournament_round_results")
        .update(myRow)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin.from("tournament_round_results").insert(myRow);
      if (error) throw new Error(error.message);
    }

    if (!data.is_bye && data.opponent_player_id) {
      const mirrorTurnOrder =
        data.turn_order === "first" ? "second" : data.turn_order === "second" ? "first" : null;
      const mirrorWonDieRoll = data.won_die_roll == null ? null : !data.won_die_roll;
      const mirrorWonMatch = data.won_match == null ? null : !data.won_match;

      const opponentRow = {
        tournament_id: data.tournament_id,
        reporter_player_id: player.id,
        player_id: data.opponent_player_id,
        opponent_player_id: player.id,
        round_number: data.round_number,
        is_bye: false,
        player_leader_id: data.opponent_leader_id ?? null,
        opponent_leader_id: data.player_leader_id ?? null,
        won_die_roll: mirrorWonDieRoll,
        turn_order: mirrorTurnOrder,
        won_match: mirrorWonMatch,
        notes: null,
        is_auto_populated: true,
        status: "pending_confirmation" as const,
        updated_at: new Date().toISOString(),
      };

      const { data: existingMirror } = await admin
        .from("tournament_round_results")
        .select("id, is_auto_populated")
        .eq("tournament_id", data.tournament_id)
        .eq("player_id", data.opponent_player_id)
        .eq("round_number", data.round_number)
        .maybeSingle();

      if (!existingMirror) {
        const { error } = await admin.from("tournament_round_results").insert(opponentRow);
        if (error) throw new Error(error.message);
      } else if (existingMirror.is_auto_populated) {
        const { error } = await admin
          .from("tournament_round_results")
          .update(opponentRow)
          .eq("id", existingMirror.id);
        if (error) throw new Error(error.message);
      }
    }

    return { success: true };
  });

// ============================================================
// clearTournamentRounds — borra todas las rondas del jugador actual para un torneo
// ============================================================
export const clearTournamentRounds = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
  .inputValidator((d: { tournament_id: string }) =>
    z.object({ tournament_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    const { error } = await admin
      .from("tournament_round_results")
      .delete()
      .eq("tournament_id", data.tournament_id)
      .eq("player_id", player.id);

    if (error) throw new Error(error.message);
    return { success: true };
  });

// ============================================================
// deleteRoundResult — borra una ronda específica del jugador actual
// ============================================================
export const deleteRoundResult = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
  .inputValidator((d: { tournament_id: string; round_number: number }) =>
    z
      .object({
        tournament_id: z.string().uuid(),
        round_number: z.number().int().min(1).max(10),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    const { error } = await admin
      .from("tournament_round_results")
      .delete()
      .eq("tournament_id", data.tournament_id)
      .eq("player_id", player.id)
      .eq("round_number", data.round_number);

    if (error) throw new Error(error.message);
    return { success: true };
  });

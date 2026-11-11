import { failDb } from "./nexus-admin.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireNexusUser } from "./nexus-auth.middleware";

export const getMyTrackedTournaments = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .handler(async ({ context }) => {
    const { admin, player } = context;

    // Torneos donde el player tiene rondas registradas en tournament_round_results
    const { data: rounds } = await admin
      .from("tournament_round_results")
      .select("tournament_id")
      .eq("player_id", player.id)
      .eq("is_bye", false)
      .not("won_match", "is", null);

    const uniqueTournamentIds = Array.from(
      new Set((rounds ?? []).map((r: any) => r.tournament_id)),
    );

    if (uniqueTournamentIds.length === 0) return { tournaments: [] };

    const { data: tournaments } = await admin
      .from("tournaments")
      .select(
        "id, tournament_date, game_id, store_id, status, stores!inner(name, city), games!inner(name, slug)",
      )
      .in("id", uniqueTournamentIds)
      .in("status", ["APPROVED", "PUBLISHED"])
      .order("tournament_date", { ascending: false });

    // Contar rondas por torneo
    const { data: roundCounts } = await admin
      .from("tournament_round_results")
      .select("tournament_id")
      .eq("player_id", player.id)
      .eq("is_bye", false)
      .not("won_match", "is", null)
      .in("tournament_id", uniqueTournamentIds);

    const countMap = new Map<string, number>();
    for (const r of roundCounts ?? []) {
      countMap.set(r.tournament_id, (countMap.get(r.tournament_id) ?? 0) + 1);
    }

    // Wins por torneo
    const { data: winCounts } = await admin
      .from("tournament_round_results")
      .select("tournament_id")
      .eq("player_id", player.id)
      .eq("won_match", true)
      .eq("is_bye", false)
      .in("tournament_id", uniqueTournamentIds);

    const winMap = new Map<string, number>();
    for (const r of winCounts ?? []) {
      winMap.set(r.tournament_id, (winMap.get(r.tournament_id) ?? 0) + 1);
    }

    return {
      tournaments: (tournaments ?? []).map((t: any) => ({
        id: t.id as string,
        tournament_date: t.tournament_date as string,
        game_id: t.game_id as string,
        game_name: t.games?.name ?? "—",
        game_slug: t.games?.slug ?? "",
        store_name: t.stores?.name ?? "—",
        store_city: t.stores?.city ?? "—",
        status: t.status as string,
        total_rounds: countMap.get(t.id) ?? 0,
        wins: winMap.get(t.id) ?? 0,
        losses: (countMap.get(t.id) ?? 0) - (winMap.get(t.id) ?? 0),
      })),
    };
  });

export const getTournamentSessionDetail = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: { tournament_id: string }) =>
    z.object({ tournament_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    // Datos del torneo
    const { data: tournament } = await admin
      .from("tournaments")
      .select(
        "id, tournament_date, game_id, store_id, status, stores!inner(name, city), games!inner(name, slug)",
      )
      .eq("id", data.tournament_id)
      .single();

    if (!tournament) throw new Error("Torneo no encontrado");
    const t = tournament as any;

    // Rondas del player en este torneo
    const { data: rounds } = await admin
      .from("tournament_round_results")
      .select(
        "id, round_number, is_bye, player_leader_id, opponent_leader_id, opponent_player_id, won_die_roll, turn_order, won_match, notes, status, is_auto_populated",
      )
      .eq("tournament_id", data.tournament_id)
      .eq("player_id", player.id)
      .eq("is_bye", false)
      .not("won_match", "is", null)
      .order("round_number", { ascending: true });

    const roundList = rounds ?? [];

    // Enriquecer con leaders y oponentes
    const leaderIds = Array.from(
      new Set(
        roundList.flatMap((r: any) => [r.player_leader_id, r.opponent_leader_id]).filter(Boolean),
      ),
    );
    const opponentIds = Array.from(
      new Set(roundList.map((r: any) => r.opponent_player_id).filter(Boolean)),
    );

    const [leadersRes, opponentsRes] = await Promise.all([
      leaderIds.length
        ? admin
            .from("deck_identifiers")
            .select("id, base_name, card_image, card_set_id")
            .in("id", leaderIds)
        : Promise.resolve({ data: [] as any[] }),
      opponentIds.length
        ? admin.from("players").select("id, geek_tag").in("id", opponentIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const leaderMap = new Map(((leadersRes.data ?? []) as any[]).map((l: any) => [l.id, l]));
    const opponentMap = new Map(
      ((opponentsRes.data ?? []) as any[]).map((p: any) => [p.id, p.geek_tag]),
    );

    return {
      session: {
        id: t.id as string,
        session_type: "competitive" as const,
        name: t.stores?.name ?? "—",
        status: "matched" as const,
        game_id: t.game_id as string,
        game_name: t.games?.name ?? "—",
        session_date: t.tournament_date as string,
        session_time: null,
        store_name: t.stores?.name ?? null,
        store_city: t.stores?.city ?? null,
        tournament_id: t.id as string,
        tournament_date: t.tournament_date as string,
        tournament_store_name: t.stores?.name ?? null,
        is_official: true, // flag para distinguirlo de standalone
      },
      rounds: roundList.map((r: any) => ({
        id: r.id as string,
        round_number: r.round_number as number,
        is_bye: r.is_bye as boolean,
        won_die_roll: r.won_die_roll as boolean | null,
        turn_order: r.turn_order as "first" | "second" | null,
        won_match: r.won_match as boolean | null,
        notes: r.notes as string | null,
        status: r.status as string,
        is_auto_populated: r.is_auto_populated as boolean,
        player_leader: r.player_leader_id ? (leaderMap.get(r.player_leader_id) ?? null) : null,
        opponent_leader: r.opponent_leader_id
          ? (leaderMap.get(r.opponent_leader_id) ?? null)
          : null,
        opponent_tag: r.opponent_player_id ? (opponentMap.get(r.opponent_player_id) ?? "—") : "—",
      })),
    };
  });

// ============================================================
// getMyAttendedTournamentIds — de una lista de torneos, cuáles jugó el player
// ============================================================
export const getMyAttendedTournamentIds = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: { tournament_ids: string[] }) =>
    z.object({ tournament_ids: z.array(z.string().uuid()) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    if (data.tournament_ids.length === 0) return { tournament_ids: [] as string[] };

    const { data: results, error } = await admin
      .from("tournament_results")
      .select("tournament_id")
      .eq("player_id", player.id)
      .in("tournament_id", data.tournament_ids);
    if (error) failDb(error);

    return {
      tournament_ids: Array.from(new Set((results ?? []).map((r: any) => r.tournament_id as string))),
    };
  });

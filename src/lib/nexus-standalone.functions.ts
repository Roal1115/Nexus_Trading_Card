import { failDb } from "./nexus-admin.server";
import type { TablesUpdate } from "./database.types";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireNexusUser } from "./nexus-auth.middleware";

// ============================================================
// searchStores — busca tiendas activas por nombre para autocompletar
// ============================================================
export const searchStores = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: { search: string }) => z.object({ search: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const { data: stores } = await admin
      .from("stores")
      .select("id, name, city, zone")
      .ilike("name", `%${data.search}%`)
      .eq("is_active", true)
      .order("name")
      .limit(10);
    return {
      stores: (stores ?? []) as {
        id: string;
        name: string;
        city: string | null;
        zone: string | null;
      }[],
    };
  });

// ============================================================
// createStandaloneSession
// ============================================================
export const createStandaloneSession = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator(
    (d: {
      session_type: "competitive" | "casual";
      name: string;
      game_id: string;
      session_date?: string | null;
      session_time?: string | null;
      store_id?: string | null;
      player_leader_id?: string | null;
    }) =>
      z
        .object({
          session_type: z.enum(["competitive", "casual"]),
          name: z.string().min(1).max(100),
          game_id: z.string().uuid(),
          session_date: z.string().nullable().optional(),
          session_time: z.string().nullable().optional(),
          store_id: z.string().uuid().nullable().optional(),
          player_leader_id: z.string().uuid().nullable().optional(),
        })
        .refine(
          (d) =>
            d.session_type !== "competitive" ||
            (d.session_date != null && d.session_time != null && d.store_id != null),
          {
            message: "Sesiones competitivas requieren fecha, hora y tienda obligatoriamente",
          },
        )
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    const { data: session, error } = await admin
      .from("standalone_sessions")
      .insert({
        player_id: player.id,
        game_id: data.game_id,
        session_type: data.session_type,
        name: data.name,
        session_date: data.session_date ?? null,
        session_time: data.session_time ?? null,
        store_id: data.store_id ?? null,
        player_leader_id: data.player_leader_id ?? null,
        status: data.session_type === "casual" ? "casual" : "unlinked",
      })
      .select("id, name, session_type, status, created_at")
      .single();

    if (error) failDb(error);
    return { session };
  });

// ============================================================
// getStandaloneSessions — lista sesiones del player con metadata
// ============================================================
export const getStandaloneSessions = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .handler(async ({ context }) => {
    const { admin, player } = context;

    const { data: sessions, error } = await admin
      .from("standalone_sessions")
      .select(
        "id, session_type, name, status, game_id, session_date, session_time, store_id, tournament_id, player_leader_id, created_at, updated_at",
      )
      .eq("player_id", player.id)
      .order("created_at", { ascending: false });

    if (error) failDb(error);
    const sessionList = sessions ?? [];

    // Enriquecer con nombre del juego, tienda, torneo vinculado, leader y récord
    const gameIds = Array.from(new Set(sessionList.map((s: any) => s.game_id)));
    const storeIds = Array.from(new Set(sessionList.map((s: any) => s.store_id).filter(Boolean)));
    const tournamentIds = Array.from(
      new Set(sessionList.map((s: any) => s.tournament_id).filter(Boolean)),
    );
    const sessionIds = sessionList.map((s: any) => s.id);
    const leaderIds = Array.from(
      new Set(sessionList.map((s: any) => s.player_leader_id).filter(Boolean)),
    );

    const [gamesRes, storesRes, tournamentsRes, roundsRes, leadersRes] = await Promise.all([
      gameIds.length
        ? admin.from("games").select("id, name").in("id", gameIds)
        : Promise.resolve({ data: [] as any[] }),
      storeIds.length
        ? admin.from("stores").select("id, name, city").in("id", storeIds)
        : Promise.resolve({ data: [] as any[] }),
      tournamentIds.length
        ? admin
            .from("tournaments")
            .select("id, tournament_date, stores!inner(name, city)")
            .in("id", tournamentIds)
        : Promise.resolve({ data: [] as any[] }),
      sessionIds.length
        ? admin
            .from("standalone_round_results")
            .select("session_id, won_match")
            .in("session_id", sessionIds)
        : Promise.resolve({ data: [] as any[] }),
      leaderIds.length
        ? admin
            .from("deck_identifiers")
            .select("id, base_name, card_image, card_set_id")
            .in("id", leaderIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const gameMap = new Map(((gamesRes.data ?? []) as any[]).map((g: any) => [g.id, g.name]));
    const storeMap = new Map(((storesRes.data ?? []) as any[]).map((s: any) => [s.id, s]));
    const tournamentMap = new Map(
      ((tournamentsRes.data ?? []) as any[]).map((t: any) => [t.id, t]),
    );
    const leaderMap = new Map(((leadersRes.data ?? []) as any[]).map((l: any) => [l.id, l]));

    const recordMap = new Map<string, { wins: number; losses: number }>();
    for (const r of (roundsRes.data ?? []) as any[]) {
      const rec = recordMap.get(r.session_id) ?? { wins: 0, losses: 0 };
      if (r.won_match === true) rec.wins++;
      else if (r.won_match === false) rec.losses++;
      recordMap.set(r.session_id, rec);
    }

    return {
      sessions: sessionList.map((s: any) => {
        const store = s.store_id ? storeMap.get(s.store_id) : null;
        const tournament = s.tournament_id ? tournamentMap.get(s.tournament_id) : null;
        const record = recordMap.get(s.id) ?? { wins: 0, losses: 0 };
        const totalDecided = record.wins + record.losses;
        return {
          id: s.id as string,
          session_type: s.session_type as "competitive" | "casual",
          name: s.name as string,
          status: s.status as "unlinked" | "matched" | "casual",
          game_id: s.game_id as string,
          game_name: (gameMap.get(s.game_id) as string | undefined) ?? "—",
          session_date: s.session_date as string | null,
          session_time: s.session_time as string | null,
          store_name: (store as any)?.name ?? null,
          store_city: (store as any)?.city ?? null,
          tournament_id: s.tournament_id as string | null,
          tournament_date: (tournament as any)?.tournament_date ?? null,
          tournament_store_name: (tournament as any)?.stores?.name ?? null,
          leader: s.player_leader_id ? (leaderMap.get(s.player_leader_id) ?? null) : null,
          wins: record.wins,
          losses: record.losses,
          win_rate: totalDecided > 0 ? Math.round((record.wins / totalDecided) * 100) : null,
          created_at: s.created_at as string,
          updated_at: s.updated_at as string,
        };
      }),
    };
  });

// ============================================================
// getStandaloneSessionDetail — rondas de una sesión específica
// ============================================================
export const getStandaloneSessionDetail = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: { session_id: string }) =>
    z.object({ session_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    const { data: session, error: sessionError } = await admin
      .from("standalone_sessions")
      .select(
        "id, session_type, name, status, game_id, session_date, session_time, store_id, tournament_id, player_leader_id, created_at",
      )
      .eq("id", data.session_id)
      .eq("player_id", player.id)
      .maybeSingle();

    if (sessionError) failDb(sessionError);
    if (!session) throw new Error("Sesión no encontrada");

    const { data: rounds, error: roundsError } = await admin
      .from("standalone_round_results")
      .select(
        "id, round_number, is_bye, player_leader_id, opponent_leader_id, opponent_player_id, won_die_roll, turn_order, won_match, notes, status, is_auto_populated",
      )
      .eq("session_id", data.session_id)
      .order("round_number", { ascending: true });

    if (roundsError) failDb(roundsError);
    const roundList = rounds ?? [];

    // Enriquecer con leaders y oponentes
    const leaderIds = Array.from(
      new Set(
        roundList
          .flatMap((r: any) => [r.player_leader_id, r.opponent_leader_id])
          .concat((session as any).player_leader_id)
          .filter(Boolean),
      ),
    );
    const opponentIds = Array.from(
      new Set(roundList.map((r: any) => r.opponent_player_id).filter(Boolean)),
    );

    const [leadersRes, opponentsRes, gameRes, storeRes] = await Promise.all([
      leaderIds.length
        ? admin
            .from("deck_identifiers")
            .select("id, base_name, card_image, card_set_id")
            .in("id", leaderIds)
        : Promise.resolve({ data: [] as any[] }),
      opponentIds.length
        ? admin.from("players").select("id, geek_tag").in("id", opponentIds)
        : Promise.resolve({ data: [] as any[] }),
      admin
        .from("games")
        .select("id, name")
        .eq("id", (session as any).game_id)
        .maybeSingle(),
      (session as any).store_id
        ? admin
            .from("stores")
            .select("id, name, city")
            .eq("id", (session as any).store_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const leaderMap = new Map(((leadersRes.data ?? []) as any[]).map((l: any) => [l.id, l]));
    const opponentMap = new Map(
      ((opponentsRes.data ?? []) as any[]).map((p: any) => [p.id, p.geek_tag]),
    );

    return {
      session: {
        ...(session as any),
        game_name: (gameRes.data as any)?.name ?? "—",
        store_name: (storeRes.data as any)?.name ?? null,
        store_city: (storeRes.data as any)?.city ?? null,
        player_leader: (session as any).player_leader_id
          ? (leaderMap.get((session as any).player_leader_id) ?? null)
          : null,
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
// saveStandaloneRound — guarda o actualiza una ronda
// ============================================================
export const saveStandaloneRound = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator(
    (d: {
      session_id: string;
      round_number: number;
      is_bye: boolean;
      player_leader_id?: string | null;
      opponent_leader_id?: string | null;
      opponent_player_id?: string | null;
      won_die_roll?: boolean | null;
      turn_order?: "first" | "second" | null;
      won_match?: boolean | null;
      notes?: string | null;
    }) =>
      z
        .object({
          session_id: z.string().uuid(),
          round_number: z.number().int().min(1).max(20),
          is_bye: z.boolean(),
          player_leader_id: z.string().uuid().nullable().optional(),
          opponent_leader_id: z.string().uuid().nullable().optional(),
          opponent_player_id: z.string().uuid().nullable().optional(),
          won_die_roll: z.boolean().nullable().optional(),
          turn_order: z.enum(["first", "second"]).nullable().optional(),
          won_match: z.boolean().nullable().optional(),
          notes: z.string().max(1000).nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    // Verificar que la sesión pertenece al player y no está matched
    const { data: session } = await admin
      .from("standalone_sessions")
      .select("id, status")
      .eq("id", data.session_id)
      .eq("player_id", player.id)
      .maybeSingle();

    if (!session) throw new Error("Sesión no encontrada o no autorizado");
    if (session.status === "matched")
      throw new Error("No puedes editar una sesión ya vinculada a un torneo oficial");

    const wonMatch = data.is_bye ? true : (data.won_match ?? null);

    const payload = {
      session_id: data.session_id,
      player_id: player.id,
      round_number: data.round_number,
      is_bye: data.is_bye,
      player_leader_id: data.player_leader_id ?? null,
      opponent_leader_id: data.is_bye ? null : (data.opponent_leader_id ?? null),
      opponent_player_id: data.is_bye ? null : (data.opponent_player_id ?? null),
      won_die_roll: data.is_bye ? null : (data.won_die_roll ?? null),
      turn_order: data.is_bye ? null : (data.turn_order ?? null),
      won_match: wonMatch,
      notes: data.notes ?? null,
      reporter_player_id: player.id,
      status: "confirmed" as const,
      updated_at: new Date().toISOString(),
    };

    // Upsert por session_id + player_id + round_number
    const { data: existing } = await admin
      .from("standalone_round_results")
      .select("id")
      .eq("session_id", data.session_id)
      .eq("player_id", player.id)
      .eq("round_number", data.round_number)
      .maybeSingle();

    if (existing) {
      const { error } = await admin
        .from("standalone_round_results")
        .update(payload)
        .eq("id", existing.id);
      if (error) failDb(error);
    } else {
      const { error } = await admin.from("standalone_round_results").insert(payload);
      if (error) failDb(error);
    }

    return { success: true };
  });

// ============================================================
// deleteStandaloneRound — elimina una ronda específica
// ============================================================
export const deleteStandaloneRound = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: { session_id: string; round_number: number }) =>
    z
      .object({
        session_id: z.string().uuid(),
        round_number: z.number().int().min(1).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    const { error } = await admin
      .from("standalone_round_results")
      .delete()
      .eq("session_id", data.session_id)
      .eq("player_id", player.id)
      .eq("round_number", data.round_number);

    if (error) failDb(error);
    return { success: true };
  });

// ============================================================
// deleteStandaloneSession — elimina una sesión y sus rondas
// ============================================================
export const deleteStandaloneSession = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: { session_id: string }) =>
    z.object({ session_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    const { data: session } = await admin
      .from("standalone_sessions")
      .select("id, status")
      .eq("id", data.session_id)
      .eq("player_id", player.id)
      .maybeSingle();

    if (!session) throw new Error("Sesión no encontrada o no autorizado");
    if (session.status === "matched")
      throw new Error("Debes deshacer el vínculo antes de eliminar una sesión vinculada");

    // Las rondas se eliminan en cascada por FK ON DELETE CASCADE
    const { error } = await admin
      .from("standalone_sessions")
      .delete()
      .eq("id", data.session_id)
      .eq("player_id", player.id);

    if (error) failDb(error);
    return { success: true };
  });

// ============================================================
// updateStandaloneSessionDetails — actualiza nombre y/o fecha de una sesión
// ============================================================
export const updateStandaloneSessionDetails = createServerFn({ method: "POST" })
  .middleware([requireNexusUser])
  .inputValidator((d: { session_id: string; name?: string; session_date?: string | null }) =>
    z
      .object({
        session_id: z.string().uuid(),
        name: z.string().trim().min(1).max(100).optional(),
        session_date: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    const { data: session } = await admin
      .from("standalone_sessions")
      .select("id")
      .eq("id", data.session_id)
      .eq("player_id", player.id)
      .maybeSingle();

    if (!session) throw new Error("Sesión no encontrada o no autorizado");

    const patch: TablesUpdate<"standalone_sessions"> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.session_date !== undefined) patch.session_date = data.session_date;
    if (Object.keys(patch).length === 0) return { success: true };

    const { error } = await admin
      .from("standalone_sessions")
      .update(patch)
      .eq("id", data.session_id)
      .eq("player_id", player.id);

    if (error) failDb(error);
    return { success: true };
  });

// Barrel: linking y tracker viven en sus propios archivos.
export * from "./nexus-standalone-linking.functions";
export * from "./nexus-standalone-tracker.functions";

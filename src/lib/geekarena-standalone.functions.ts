import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireGeekarenaUser } from "./geekarena-auth.middleware";

// ============================================================
// searchStores — busca tiendas activas por nombre para autocompletar
// ============================================================
export const searchStores = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
  .inputValidator((d: { search: string }) =>
    z.object({ search: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const { data: stores } = await admin
      .from("stores")
      .select("id, name, city, zone")
      .ilike("name", `%${data.search}%`)
      .eq("is_active", true)
      .order("name")
      .limit(10);
    return { stores: (stores ?? []) as { id: string; name: string; city: string | null; zone: string | null }[] };
  });


// ============================================================
// createStandaloneSession
// ============================================================
export const createStandaloneSession = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
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

    if (error) throw new Error(error.message);
    return { session };
  });

// ============================================================
// getStandaloneSessions — lista sesiones del player con metadata
// ============================================================
export const getStandaloneSessions = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
  .handler(async ({ context }) => {
    const { admin, player } = context;

    const { data: sessions, error } = await admin
      .from("standalone_sessions")
      .select(
        "id, session_type, name, status, game_id, session_date, session_time, store_id, tournament_id, created_at, updated_at",
      )
      .eq("player_id", player.id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    const sessionList = sessions ?? [];

    // Enriquecer con nombre del juego, tienda y torneo vinculado
    const gameIds = Array.from(new Set(sessionList.map((s: any) => s.game_id)));
    const storeIds = Array.from(new Set(sessionList.map((s: any) => s.store_id).filter(Boolean)));
    const tournamentIds = Array.from(
      new Set(sessionList.map((s: any) => s.tournament_id).filter(Boolean)),
    );

    const [gamesRes, storesRes, tournamentsRes] = await Promise.all([
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
    ]);

    const gameMap = new Map(((gamesRes.data ?? []) as any[]).map((g: any) => [g.id, g.name]));
    const storeMap = new Map(((storesRes.data ?? []) as any[]).map((s: any) => [s.id, s]));
    const tournamentMap = new Map(
      ((tournamentsRes.data ?? []) as any[]).map((t: any) => [t.id, t]),
    );

    return {
      sessions: sessionList.map((s: any) => {
        const store = s.store_id ? storeMap.get(s.store_id) : null;
        const tournament = s.tournament_id ? tournamentMap.get(s.tournament_id) : null;
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
  .middleware([requireGeekarenaUser])
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

    if (sessionError) throw new Error(sessionError.message);
    if (!session) throw new Error("Sesión no encontrada");

    const { data: rounds, error: roundsError } = await admin
      .from("standalone_round_results")
      .select(
        "id, round_number, is_bye, player_leader_id, opponent_leader_id, opponent_player_id, won_die_roll, turn_order, won_match, notes, status, is_auto_populated",
      )
      .eq("session_id", data.session_id)
      .order("round_number", { ascending: true });

    if (roundsError) throw new Error(roundsError.message);
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
  .middleware([requireGeekarenaUser])
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
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin.from("standalone_round_results").insert(payload);
      if (error) throw new Error(error.message);
    }

    return { success: true };
  });

// ============================================================
// deleteStandaloneRound — elimina una ronda específica
// ============================================================
export const deleteStandaloneRound = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
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

    if (error) throw new Error(error.message);
    return { success: true };
  });

// ============================================================
// deleteStandaloneSession — elimina una sesión y sus rondas
// ============================================================
export const deleteStandaloneSession = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
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

    if (error) throw new Error(error.message);
    return { success: true };
  });

// ============================================================
// updateStandaloneSessionDetails — actualiza nombre y/o fecha de una sesión
// ============================================================
export const updateStandaloneSessionDetails = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
  .inputValidator(
    (d: { session_id: string; name?: string; session_date?: string | null }) =>
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

    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.session_date !== undefined) patch.session_date = data.session_date;
    if (Object.keys(patch).length === 0) return { success: true };

    const { error } = await admin
      .from("standalone_sessions")
      .update(patch)
      .eq("id", data.session_id)
      .eq("player_id", player.id);

    if (error) throw new Error(error.message);
    return { success: true };
  });

// ============================================================
// undoSessionLink — revierte el vínculo de una sesión matched
// ============================================================
export const undoSessionLink = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
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

    if (deleteError) throw new Error(deleteError.message);

    // Revertir la sesión a unlinked
    const { error: updateError } = await admin
      .from("standalone_sessions")
      .update({
        status: "unlinked",
        tournament_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.session_id);

    if (updateError) throw new Error(updateError.message);

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
  .middleware([requireGeekarenaUser])
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
  .middleware([requireGeekarenaUser])
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

      if (insertError) throw new Error(insertError.message);
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

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireNexusOrganizer } from "./nexus-auth.middleware";
import { failDb } from "./nexus-admin.server";

// Épica 4: los tcg_manager NO tienen jurisdicción sobre ligas internas —
// requireNexusOrganizer permite organizer/tcg_manager/admin, así que se
// filtra aquí explícitamente en cada handler que toca store_leagues.
function assertLeagueManager(role: string) {
  if (role !== "organizer" && role !== "admin") {
    throw new Error("No autorizado: las ligas internas son solo para organizadores y administradores");
  }
}

async function assertOwnsStore(admin: any, player: any, store_id: string) {
  if (player.role === "admin") return;
  if (player.home_store_id !== store_id) {
    throw new Error("Solo puedes administrar las ligas de tu tienda asignada");
  }
}

async function assertLeaguesEnabled(admin: any, store_id: string) {
  const { data: store, error } = await admin
    .from("stores")
    .select("internal_leagues_enabled")
    .eq("id", store_id)
    .maybeSingle();
  if (error) failDb(error);
  if (!store?.internal_leagues_enabled) {
    throw new Error("Las ligas internas no están habilitadas para esta tienda");
  }
}

const weekdaysSchema = z.array(z.number().int().min(0).max(6)).min(1).max(7);

export const listStoreLeagues = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: { store_id: string }) => z.object({ store_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    assertLeagueManager(player.role);
    await assertOwnsStore(admin, player, data.store_id);

    const { data: store, error: se } = await admin
      .from("stores")
      .select("internal_leagues_enabled")
      .eq("id", data.store_id)
      .maybeSingle();
    if (se) failDb(se);

    const { data: leagues, error } = await admin
      .from("store_leagues")
      .select("*, store_league_tournaments(tournament_id), store_league_prizes(*)")
      .eq("store_id", data.store_id)
      .order("created_at", { ascending: false });
    if (error) failDb(error);
    return { leagues: leagues ?? [], enabled: store?.internal_leagues_enabled ?? false };
  });

export const createStoreLeague = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator(
    (d: { store_id: string; name: string; start_date: string; end_date: string; active_weekdays: number[] }) =>
      z
        .object({
          store_id: z.string().uuid(),
          name: z.string().min(1).max(120),
          start_date: z.string(),
          end_date: z.string(),
          active_weekdays: weekdaysSchema,
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    assertLeagueManager(player.role);
    await assertOwnsStore(admin, player, data.store_id);
    await assertLeaguesEnabled(admin, data.store_id);
    if (data.end_date < data.start_date) throw new Error("La fecha de fin no puede ser anterior a la de inicio");

    const { data: league, error } = await admin
      .from("store_leagues")
      .insert({
        store_id: data.store_id,
        name: data.name,
        start_date: data.start_date,
        end_date: data.end_date,
        active_weekdays: data.active_weekdays,
        created_by: player.id,
      })
      .select()
      .single();
    if (error) failDb(error);
    return { league };
  });

export const updateStoreLeague = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator(
    (d: { league_id: string; name: string; start_date: string; end_date: string; active_weekdays: number[] }) =>
      z
        .object({
          league_id: z.string().uuid(),
          name: z.string().min(1).max(120),
          start_date: z.string(),
          end_date: z.string(),
          active_weekdays: weekdaysSchema,
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    assertLeagueManager(player.role);
    if (data.end_date < data.start_date) throw new Error("La fecha de fin no puede ser anterior a la de inicio");

    const { data: league, error: fe } = await admin
      .from("store_leagues")
      .select("store_id, status")
      .eq("id", data.league_id)
      .maybeSingle();
    if (fe) failDb(fe);
    if (!league) throw new Error("Liga no encontrada");
    if (league.status === "archived") throw new Error("No se puede editar una liga archivada");
    await assertOwnsStore(admin, player, league.store_id);

    const { error } = await admin
      .from("store_leagues")
      .update({
        name: data.name,
        start_date: data.start_date,
        end_date: data.end_date,
        active_weekdays: data.active_weekdays,
      })
      .eq("id", data.league_id);
    if (error) failDb(error);
    return { ok: true };
  });

export const setLeagueTournaments = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: { league_id: string; tournament_ids: string[] }) =>
    z.object({ league_id: z.string().uuid(), tournament_ids: z.array(z.string().uuid()) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    assertLeagueManager(player.role);

    const { data: league, error: fe } = await admin
      .from("store_leagues")
      .select("store_id, status")
      .eq("id", data.league_id)
      .maybeSingle();
    if (fe) failDb(fe);
    if (!league) throw new Error("Liga no encontrada");
    if (league.status === "archived") throw new Error("No se puede editar una liga archivada");
    await assertOwnsStore(admin, player, league.store_id);

    if (data.tournament_ids.length) {
      const { data: owned, error: te } = await admin
        .from("tournaments")
        .select("id")
        .eq("store_id", league.store_id)
        .in("id", data.tournament_ids);
      if (te) failDb(te);
      if ((owned ?? []).length !== data.tournament_ids.length) {
        throw new Error("Todos los torneos deben pertenecer a la misma tienda");
      }
    }

    const { error: de } = await admin.from("store_league_tournaments").delete().eq("league_id", data.league_id);
    if (de) failDb(de);

    if (data.tournament_ids.length) {
      const { error: ie } = await admin
        .from("store_league_tournaments")
        .insert(data.tournament_ids.map((tournament_id) => ({ league_id: data.league_id, tournament_id })));
      if (ie) failDb(ie);
    }
    return { ok: true };
  });

export const setLeaguePrizes = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator(
    (d: { league_id: string; prizes: Array<{ description: string; image_url?: string | null }> }) =>
      z
        .object({
          league_id: z.string().uuid(),
          prizes: z
            .array(
              z.object({
                description: z.string().min(1).max(500),
                image_url: z.string().max(500).nullable().optional(),
              }),
            )
            .max(50),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    assertLeagueManager(player.role);

    const { data: league, error: fe } = await admin
      .from("store_leagues")
      .select("store_id")
      .eq("id", data.league_id)
      .maybeSingle();
    if (fe) failDb(fe);
    if (!league) throw new Error("Liga no encontrada");
    await assertOwnsStore(admin, player, league.store_id);

    const { error: de } = await admin.from("store_league_prizes").delete().eq("league_id", data.league_id);
    if (de) failDb(de);

    if (data.prizes.length) {
      const { error: ie } = await admin.from("store_league_prizes").insert(
        data.prizes.map((p, i) => ({
          league_id: data.league_id,
          description: p.description,
          image_url: p.image_url || null,
          sort_order: i,
        })),
      );
      if (ie) failDb(ie);
    }
    return { ok: true };
  });

export const archiveStoreLeague = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: { league_id: string }) => z.object({ league_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    assertLeagueManager(player.role);

    const { data: league, error: fe } = await admin
      .from("store_leagues")
      .select("store_id, status")
      .eq("id", data.league_id)
      .maybeSingle();
    if (fe) failDb(fe);
    if (!league) throw new Error("Liga no encontrada");
    if (league.status === "archived") return { ok: true };
    await assertOwnsStore(admin, player, league.store_id);

    const { data: links } = await admin
      .from("store_league_tournaments")
      .select("tournament_id")
      .eq("league_id", data.league_id);
    const tournamentIds = (links ?? []).map((l) => l.tournament_id);

    let winnerPlayerId: string | null = null;
    let winnerPoints: number | null = null;
    if (tournamentIds.length) {
      const { data: results, error: re } = await admin
        .from("tournament_results")
        .select("player_id, points_earned")
        .in("tournament_id", tournamentIds);
      if (re) failDb(re);

      const totals = new Map<string, number>();
      for (const r of results ?? []) {
        totals.set(r.player_id, (totals.get(r.player_id) ?? 0) + (r.points_earned ?? 0));
      }
      let best: [string, number] | null = null;
      for (const entry of totals) {
        if (!best || entry[1] > best[1]) best = entry;
      }
      if (best) {
        winnerPlayerId = best[0];
        winnerPoints = best[1];
      }
    }

    const { error } = await admin
      .from("store_leagues")
      .update({ status: "archived", winner_player_id: winnerPlayerId, winner_points: winnerPoints })
      .eq("id", data.league_id);
    if (error) failDb(error);
    return { ok: true };
  });

// ---------- Para el dropdown de /organizer/new ----------

export const listStoreTournamentsForLeagues = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: { store_id: string }) => z.object({ store_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    assertLeagueManager(player.role);
    await assertOwnsStore(admin, player, data.store_id);

    const { data: tournaments, error } = await admin
      .from("tournaments")
      .select("id, tournament_date, status, games(name)")
      .eq("store_id", data.store_id)
      .in("status", ["PUBLISHED", "APPROVED"])
      .order("tournament_date", { ascending: false });
    if (error) failDb(error);
    return {
      tournaments: (tournaments ?? []).map((t: any) => ({
        id: t.id,
        tournament_date: t.tournament_date,
        status: t.status,
        game_name: (Array.isArray(t.games) ? t.games[0] : t.games)?.name ?? "—",
      })),
    };
  });

// ---------- Horarios de liga interna ----------

export const listLeagueScheduleData = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: { store_id: string }) => z.object({ store_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    assertLeagueManager(player.role);
    await assertOwnsStore(admin, player, data.store_id);

    const [nationalRes, leagueRes] = await Promise.all([
      admin
        .from("store_schedules")
        .select("id, game_id, day_of_week, start_time, games(name)")
        .eq("store_id", data.store_id),
      admin
        .from("store_league_schedules")
        .select("id, league_id, game_id, day_of_week, start_time, shares_national_slot, national_schedule_id, games(name)")
        .eq("store_id", data.store_id),
    ]);
    if (nationalRes.error) failDb(nationalRes.error);
    if (leagueRes.error) failDb(leagueRes.error);

    const mapGame = (g: any) => (Array.isArray(g) ? g[0] : g)?.name ?? "—";
    return {
      national_schedules: (nationalRes.data ?? []).map((s: any) => ({
        id: s.id,
        game_id: s.game_id,
        game_name: mapGame(s.games),
        day_of_week: s.day_of_week,
        start_time: String(s.start_time).slice(0, 5),
      })),
      league_schedules: (leagueRes.data ?? []).map((s: any) => ({
        id: s.id,
        league_id: s.league_id,
        game_id: s.game_id,
        game_name: mapGame(s.games),
        day_of_week: s.day_of_week,
        start_time: String(s.start_time).slice(0, 5),
        shares_national_slot: s.shares_national_slot,
        national_schedule_id: s.national_schedule_id,
      })),
    };
  });

export const createLeagueSchedule = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator(
    (d: {
      league_id: string;
      game_id: string;
      day_of_week: number;
      start_time: string;
      shares_national_slot: boolean;
      national_schedule_id?: string | null;
    }) =>
      z
        .object({
          league_id: z.string().uuid(),
          game_id: z.string().uuid(),
          day_of_week: z.number().int().min(0).max(6),
          start_time: z.string().regex(/^\d{2}:\d{2}$/),
          shares_national_slot: z.boolean(),
          national_schedule_id: z.string().uuid().nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    assertLeagueManager(player.role);

    const { data: league, error: fe } = await admin
      .from("store_leagues")
      .select("store_id, status")
      .eq("id", data.league_id)
      .maybeSingle();
    if (fe) failDb(fe);
    if (!league) throw new Error("Liga no encontrada");
    if (league.status === "archived") throw new Error("No se puede editar una liga archivada");
    await assertOwnsStore(admin, player, league.store_id);
    await assertLeaguesEnabled(admin, league.store_id);

    if (data.shares_national_slot) {
      if (!data.national_schedule_id) throw new Error("Falta el horario del circuito nacional a vincular");
      const { data: national, error: ne } = await admin
        .from("store_schedules")
        .select("id")
        .eq("id", data.national_schedule_id)
        .eq("store_id", league.store_id)
        .eq("game_id", data.game_id)
        .eq("day_of_week", data.day_of_week)
        .maybeSingle();
      if (ne) failDb(ne);
      if (!national) throw new Error("El horario del circuito nacional seleccionado no coincide");
    }

    const { data: created, error } = await admin
      .from("store_league_schedules")
      .insert({
        league_id: data.league_id,
        store_id: league.store_id,
        game_id: data.game_id,
        day_of_week: data.day_of_week,
        start_time: data.start_time,
        shares_national_slot: data.shares_national_slot,
        national_schedule_id: data.shares_national_slot ? data.national_schedule_id : null,
      })
      .select()
      .single();
    if (error) failDb(error);
    return { schedule: created };
  });

export const deleteLeagueSchedule = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: { schedule_id: string }) => z.object({ schedule_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    assertLeagueManager(player.role);

    const { data: schedule, error: fe } = await admin
      .from("store_league_schedules")
      .select("store_id")
      .eq("id", data.schedule_id)
      .maybeSingle();
    if (fe) failDb(fe);
    if (!schedule) return { ok: true };
    await assertOwnsStore(admin, player, schedule.store_id);

    const { error } = await admin.from("store_league_schedules").delete().eq("id", data.schedule_id);
    if (error) failDb(error);
    return { ok: true };
  });

// ---------- Excepciones puntuales a un horario de liga (una sola fecha) ----------

export const upsertLeagueScheduleOverride = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator(
    (d: { league_schedule_id: string; occurrence_date: string; start_time?: string | null; label?: string | null }) =>
      z
        .object({
          league_schedule_id: z.string().uuid(),
          occurrence_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          start_time: z
            .string()
            .regex(/^\d{2}:\d{2}$/)
            .nullable()
            .optional(),
          label: z.string().max(120).nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    assertLeagueManager(player.role);

    const { data: schedule, error: fe } = await admin
      .from("store_league_schedules")
      .select("store_id, store_leagues(status)")
      .eq("id", data.league_schedule_id)
      .maybeSingle();
    if (fe) failDb(fe);
    if (!schedule) throw new Error("Horario no encontrado");
    await assertOwnsStore(admin, player, schedule.store_id);
    const leagueStatus = (Array.isArray(schedule.store_leagues) ? schedule.store_leagues[0] : schedule.store_leagues)?.status;
    if (leagueStatus === "archived") throw new Error("No se puede editar una liga archivada");

    const { error } = await admin.from("store_league_schedule_overrides").upsert(
      {
        league_schedule_id: data.league_schedule_id,
        store_id: schedule.store_id,
        occurrence_date: data.occurrence_date,
        start_time: data.start_time || null,
        label: data.label || null,
      },
      { onConflict: "league_schedule_id,occurrence_date" },
    );
    if (error) failDb(error);
    return { ok: true };
  });

export const deleteLeagueScheduleOverride = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: { league_schedule_id: string; occurrence_date: string }) =>
    z
      .object({
        league_schedule_id: z.string().uuid(),
        occurrence_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    assertLeagueManager(player.role);

    const { data: schedule, error: fe } = await admin
      .from("store_league_schedules")
      .select("store_id")
      .eq("id", data.league_schedule_id)
      .maybeSingle();
    if (fe) failDb(fe);
    if (!schedule) return { ok: true };
    await assertOwnsStore(admin, player, schedule.store_id);

    const { error } = await admin
      .from("store_league_schedule_overrides")
      .delete()
      .eq("league_schedule_id", data.league_schedule_id)
      .eq("occurrence_date", data.occurrence_date);
    if (error) failDb(error);
    return { ok: true };
  });

export const getActiveLeaguesForStore = createServerFn({ method: "POST" })
  .middleware([requireNexusOrganizer])
  .inputValidator((d: { store_id: string }) => z.object({ store_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    if (player.role === "tcg_manager") return { leagues: [] };

    const { data: store, error: se } = await admin
      .from("stores")
      .select("internal_leagues_enabled")
      .eq("id", data.store_id)
      .maybeSingle();
    if (se) failDb(se);
    if (!store?.internal_leagues_enabled) return { leagues: [] };

    const { data: leagues, error } = await admin
      .from("store_leagues")
      .select("id, name")
      .eq("store_id", data.store_id)
      .eq("status", "active")
      .order("name");
    if (error) failDb(error);
    return { leagues: leagues ?? [] };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getNexusAdmin, failDb } from "./nexus-admin.server";
import { toLocalDateStr, todayInMexicoStr } from "./utils";

export const getPublicStoresList = createServerFn({ method: "POST" }).handler(async () => {
  const admin = getNexusAdmin();
  const { data: stores, error } = await admin
    .from("stores")
    .select(
      "id, slug, name, city, state, zone, google_maps_url, opening_hours, instagram, website, twitter, twitch",
    )
    .eq("is_active", true)
    .order("name");
  if (error) failDb(error);

  const storeIds = (stores ?? []).map((s: any) => s.id);
  const { data: schedules } = storeIds.length
    ? await admin
        .from("store_schedules")
        .select("store_id, game_id, games(id, name)")
        .in("store_id", storeIds)
    : { data: [] as any[] };

  const gamesByStore = new Map<string, Array<{ id: string; name: string }>>();
  for (const s of (schedules ?? []) as any[]) {
    const arr = gamesByStore.get(s.store_id) ?? [];
    const g = Array.isArray(s.games) ? s.games[0] : s.games;
    if (g && !arr.some((x) => x.id === g.id)) arr.push(g);
    gamesByStore.set(s.store_id, arr);
  }

  return {
    stores: (stores ?? []).map((s: any) => ({
      ...s,
      games: gamesByStore.get(s.id) ?? [],
    })),
  };
});

export const getStoreProfile = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const admin = getNexusAdmin();
    const { data: store, error } = await admin
      .from("stores")
      .select(
        "id, slug, name, city, state, zone, address, phone, google_maps_url, description, opening_hours, instagram, website, twitter, twitch",
      )
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (error) failDb(error);
    if (!store) throw new Error("Tienda no encontrada");

    const { data: schedules } = await admin
      .from("store_schedules")
      .select("game_id, games(id, name)")
      .eq("store_id", store.id);

    const games: Array<{ id: string; name: string }> = [];
    for (const s of (schedules ?? []) as any[]) {
      const g = Array.isArray(s.games) ? s.games[0] : s.games;
      if (g && !games.some((x) => x.id === g.id)) games.push(g);
    }

    return { store: { ...store, games } };
  });

export const getStoreWeeklySchedule = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const admin = getNexusAdmin();
    const { data: store } = await admin
      .from("stores")
      .select("id")
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (!store) throw new Error("Tienda no encontrada");

    const { data: schedules, error } = await admin
      .from("store_schedules")
      .select("day_of_week, start_time, games(id, name)")
      .eq("store_id", store.id)
      .order("day_of_week")
      .order("start_time");
    if (error) failDb(error);

    return {
      schedule: (schedules ?? []).map((s: any) => ({
        day_of_week: s.day_of_week,
        start_time: String(s.start_time).slice(0, 5),
        game_name: s.games?.name ?? "—",
      })),
    };
  });

export const getPublicCalendar = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      game_id?: string | null;
      zone?: string | null;
      store_id?: string | null;
      week_start: string; // "YYYY-MM-DD" — domingo (el grid público es Dom–Sáb, ver sundayOfWeek en utils)
    }) =>
      z
        .object({
          game_id: z.string().uuid().nullable().optional(),
          zone: z.string().nullable().optional(),
          store_id: z.string().uuid().nullable().optional(),
          week_start: z.string(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const admin = getNexusAdmin();

    const weekStartDate = new Date(data.week_start + "T00:00:00");
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStartDate);
      d.setDate(weekStartDate.getDate() + i);
      return toLocalDateStr(d);
    });
    const weekEndStr = weekDates[6];
    // "Hoy" en hora de México — el server corre en UTC y a las 6pm MX
    // el toISOString() de UTC ya marca mañana, ocultando torneos de hoy.
    const today = todayInMexicoStr();
    const fromDate = data.week_start < today ? today : data.week_start;

    // 1. Torneos reales publicados en esta semana
    let tournamentQuery = admin
      .from("tournaments")
      .select(
        `
        id, tournament_date, tournament_time, game_id, store_id,
        stores!inner(id, slug, name, city, state, zone, address, phone, description, opening_hours, instagram, website, twitter, twitch, google_maps_url),
        games!inner(id, name, slug)
      `,
      )
      .eq("status", "PUBLISHED")
      .gte("tournament_date", fromDate)
      .lte("tournament_date", weekEndStr);

    if (data.game_id) tournamentQuery = tournamentQuery.eq("game_id", data.game_id);
    if (data.store_id) tournamentQuery = tournamentQuery.eq("store_id", data.store_id);
    if (data.zone) tournamentQuery = tournamentQuery.eq("stores.zone", data.zone);

    const { data: tournaments, error } = await tournamentQuery;
    if (error) failDb(error);

    // 2. Store schedules (plantilla recurrente) — proyectar a fechas de esta semana
    let scheduleQuery = admin.from("store_schedules").select(
      `
        id, store_id, game_id, day_of_week, start_time,
        stores!inner(id, slug, name, city, state, zone, address, phone, description, opening_hours, instagram, website, twitter, twitch, google_maps_url),
        games!inner(id, name, slug)
      `,
    );

    if (data.game_id) scheduleQuery = scheduleQuery.eq("game_id", data.game_id);
    if (data.store_id) scheduleQuery = scheduleQuery.eq("store_id", data.store_id);
    if (data.zone) scheduleQuery = scheduleQuery.eq("stores.zone", data.zone);

    const { data: schedules, error: scheduleError } = await scheduleQuery;
    if (scheduleError) failDb(scheduleError);

    const realTournamentDates = new Set(
      (tournaments ?? []).map((t: any) => `${t.store_id}_${t.tournament_date}`),
    );

    const scheduledEvents: any[] = [];
    for (const s of (schedules ?? []) as any[]) {
      for (const dateStr of weekDates) {
        if (dateStr < fromDate) continue;
        const d = new Date(dateStr + "T12:00:00");
        if (d.getDay() !== s.day_of_week) continue;
        if (realTournamentDates.has(`${s.store_id}_${dateStr}`)) continue;

        scheduledEvents.push({
          id: `schedule_${s.id}_${dateStr}`,
          date: dateStr,
          time: s.start_time,
          game_id: s.game_id,
          game_name: s.games?.name ?? "—",
          game_slug: s.games?.slug ?? "",
          store_id: s.store_id,
          store_slug: s.stores?.slug ?? "",
          store_name: s.stores?.name ?? "—",
          store_city: s.stores?.city ?? "—",
          store_state: s.stores?.state ?? "—",
          store_address: s.stores?.address ?? null,
          store_phone: s.stores?.phone ?? null,
          store_description: s.stores?.description ?? null,
          store_opening_hours: s.stores?.opening_hours ?? null,
          store_instagram: s.stores?.instagram ?? null,
          store_website: s.stores?.website ?? null,
          store_twitter: s.stores?.twitter ?? null,
          store_twitch: s.stores?.twitch ?? null,
          store_google_maps_url: s.stores?.google_maps_url ?? null,
          zone: s.stores?.zone ?? "—",
          is_scheduled: true,
        });
      }
    }

    const allEvents = [
      ...(tournaments ?? []).map((t: any) => ({
        id: t.id,
        date: t.tournament_date as string,
        time: t.tournament_time as string | null,
        game_id: t.game_id as string,
        game_name: t.games?.name ?? "—",
        game_slug: t.games?.slug ?? "",
        store_id: t.store_id as string,
        store_slug: t.stores?.slug ?? "",
        store_name: t.stores?.name ?? "—",
        store_city: t.stores?.city ?? "—",
        store_state: t.stores?.state ?? "—",
        store_address: t.stores?.address ?? null,
        store_phone: t.stores?.phone ?? null,
        store_description: t.stores?.description ?? null,
        store_opening_hours: t.stores?.opening_hours ?? null,
        store_instagram: t.stores?.instagram ?? null,
        store_website: t.stores?.website ?? null,
        store_twitter: t.stores?.twitter ?? null,
        store_twitch: t.stores?.twitch ?? null,
        store_google_maps_url: t.stores?.google_maps_url ?? null,
        zone: t.stores?.zone ?? "—",
        is_scheduled: false,
      })),
      ...scheduledEvents,
    ].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.time ?? "00:00").localeCompare(b.time ?? "00:00");
    });

    const { data: stores } = await admin
      .from("stores")
      .select("id, name, city, zone")
      .eq("is_active", true)
      .order("name");

    const zones = Array.from(
      new Set(((stores ?? []) as any[]).map((s: any) => s.zone).filter(Boolean)),
    ).sort();

    return {
      events: allEvents,
      stores: stores ?? [],
      zones,
    };
  });

export const getPublicTournament = createServerFn({ method: "POST" })
  .inputValidator((d: { tournament_id: string }) =>
    z.object({ tournament_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const admin = getNexusAdmin();

    // 1. Torneo — solo PUBLISHED
    const { data: t } = await admin
      .from("tournaments")
      .select(
        `id, tournament_date, tournament_time, status, game_id, store_id,
         stores!inner(id, slug, name, city, state, zone),
         games!inner(id, name, slug)`,
      )
      .eq("id", data.tournament_id)
      .eq("status", "PUBLISHED")
      .maybeSingle();

    if (!t) throw new Error("Torneo no encontrado o no publicado");
    const tournament = t as any;

    // 2. Standings
    const { data: results } = await admin
      .from("tournament_results")
      .select("player_id, rank, wins, losses, draws, points_earned, omw_percentage")
      .eq("tournament_id", data.tournament_id)
      .order("rank", { ascending: true });

    const resultList = (results ?? []) as any[];
    const playerIds = resultList.map((r) => r.player_id);

    if (playerIds.length === 0) {
      return {
        tournament: {
          id: tournament.id,
          date: tournament.tournament_date,
          time: tournament.tournament_time,
          game_name: tournament.games?.name ?? "—",
          game_slug: tournament.games?.slug ?? "",
          store_name: tournament.stores?.name ?? "—",
          store_slug: tournament.stores?.slug ?? "",
          store_city: tournament.stores?.city ?? "—",
          store_state: tournament.stores?.state ?? "—",
          zone: tournament.stores?.zone ?? "—",
        },
        standings: [],
        total_participants: 0,
      };
    }

    const { data: players } = await admin
      .from("players")
      .select("id, geek_tag, is_profile_public")
      .in("id", playerIds);
    const playerMap = new Map(((players ?? []) as any[]).map((p) => [p.id, p]));

    // 3. Leader más jugado por cada player en este torneo
    const { data: rounds } = await admin
      .from("tournament_round_results")
      .select("player_id, player_leader_id")
      .eq("tournament_id", data.tournament_id)
      .not("player_leader_id", "is", null);

    const leaderCount = new Map<string, Map<string, number>>();
    for (const r of (rounds ?? []) as any[]) {
      if (!leaderCount.has(r.player_id)) leaderCount.set(r.player_id, new Map());
      const m = leaderCount.get(r.player_id)!;
      m.set(r.player_leader_id, (m.get(r.player_leader_id) ?? 0) + 1);
    }

    const topLeaderByPlayer = new Map<string, string>();
    for (const [pid, counts] of leaderCount.entries()) {
      const best = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
      if (best) topLeaderByPlayer.set(pid, best[0]);
    }

    // 4. Resolver leaders a canónico
    const rawLeaderIds = Array.from(new Set(topLeaderByPlayer.values()));
    const { data: rawLeaders } = rawLeaderIds.length
      ? await admin
          .from("deck_identifiers")
          .select("id, base_name, card_image, canonical_leader_id")
          .in("id", rawLeaderIds)
      : { data: [] as any[] };

    const variantToCanonical = new Map<string, string>();
    for (const l of (rawLeaders ?? []) as any[]) {
      if (l.canonical_leader_id) variantToCanonical.set(l.id, l.canonical_leader_id);
    }

    const existingIds = new Set(((rawLeaders ?? []) as any[]).map((l) => l.id));
    const missingCanonicalIds = Array.from(new Set(Array.from(variantToCanonical.values()))).filter(
      (id) => !existingIds.has(id),
    );

    const { data: canonicalLeaders } = missingCanonicalIds.length
      ? await admin
          .from("deck_identifiers")
          .select("id, base_name, card_image, canonical_leader_id")
          .in("id", missingCanonicalIds)
      : { data: [] as any[] };

    const leaderMap = new Map(
      [...((rawLeaders ?? []) as any[]), ...((canonicalLeaders ?? []) as any[])].map((l) => [
        l.id,
        l,
      ]),
    );
    const resolveId = (id: string): string => variantToCanonical.get(id) ?? id;

    // 5. Standings finales
    const standings = resultList.map((r) => {
      const p = playerMap.get(r.player_id) as any;
      const rawLeaderId = topLeaderByPlayer.get(r.player_id);
      const leader = rawLeaderId ? leaderMap.get(resolveId(rawLeaderId)) : null;
      return {
        rank: r.rank as number,
        geek_tag: p?.geek_tag ?? "—",
        is_profile_public: Boolean(p?.is_profile_public),
        wins: r.wins as number | null,
        losses: r.losses as number | null,
        draws: r.draws as number | null,
        points_earned: r.points_earned as number | null,
        omw_percentage: r.omw_percentage as number | null,
        leader_name: (leader as any)?.base_name ?? null,
        leader_image: (leader as any)?.card_image ?? null,
      };
    });

    return {
      tournament: {
        id: tournament.id,
        date: tournament.tournament_date,
        time: tournament.tournament_time,
        game_name: tournament.games?.name ?? "—",
        game_slug: tournament.games?.slug ?? "",
        store_name: tournament.stores?.name ?? "—",
        store_slug: tournament.stores?.slug ?? "",
        store_city: tournament.stores?.city ?? "—",
        store_state: tournament.stores?.state ?? "—",
        zone: tournament.stores?.zone ?? "—",
      },
      standings,
      total_participants: standings.length,
    };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getGeekarenaAdmin } from "./geekarena-admin.server";

export const getPublicStoresList = createServerFn({ method: "POST" }).handler(async () => {
  const admin = getGeekarenaAdmin();
  const { data: stores, error } = await admin
    .from("stores")
    .select(
      "id, slug, name, city, state, zone, google_maps_url, opening_hours, instagram, website, twitter, twitch",
    )
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);

  const storeIds = (stores ?? []).map((s: any) => s.id);
  const { data: schedules } = storeIds.length
    ? await admin.from("store_schedules").select("store_id, game_id, games(id, name)").in("store_id", storeIds)
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
    const admin = getGeekarenaAdmin();
    const { data: store, error } = await admin
      .from("stores")
      .select(
        "id, slug, name, city, state, zone, address, phone, google_maps_url, description, opening_hours, instagram, website, twitter, twitch",
      )
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
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
    const admin = getGeekarenaAdmin();
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
    if (error) throw new Error(error.message);

    return {
      schedule: (schedules ?? []).map((s: any) => ({
        day_of_week: s.day_of_week,
        start_time: String(s.start_time).slice(0, 5),
        game_name: s.games?.name ?? "—",
      })),
    };
  });

export const getPublicCalendar = createServerFn({ method: "POST" })
  .inputValidator((d: {
    game_id?: string | null;
    zone?: string | null;
    store_id?: string | null;
    year: number;
    month: number;
  }) =>
    z.object({
      game_id: z.string().uuid().nullable().optional(),
      zone: z.string().nullable().optional(),
      store_id: z.string().uuid().nullable().optional(),
      year: z.number().int().min(2024).max(2030),
      month: z.number().int().min(1).max(12),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const admin = getGeekarenaAdmin();

    const startDate = `${data.year}-${String(data.month).padStart(2, "0")}-01`;
    const endDate = new Date(data.year, data.month, 0)
      .toISOString().split("T")[0];

    let query = admin
      .from("tournaments")
      .select(`
        id, tournament_date, tournament_time, game_id,
        store_id,
        stores!inner(id, name, city, state, zone),
        games!inner(id, name, slug)
      `)
      .eq("status", "PUBLISHED")
      .gte("tournament_date", startDate)
      .lte("tournament_date", endDate)
      .order("tournament_date", { ascending: true });

    if (data.game_id) query = query.eq("game_id", data.game_id);
    if (data.store_id) query = query.eq("store_id", data.store_id);
    if (data.zone) query = query.eq("stores.zone", data.zone);

    const { data: tournaments, error } = await query;
    if (error) throw new Error(error.message);

    // Stores para filtro
    const { data: stores } = await admin
      .from("stores")
      .select("id, name, city, zone")
      .eq("is_active", true)
      .order("name");

    // Zonas únicas
    const zones = Array.from(new Set(
      ((stores ?? []) as any[]).map((s: any) => s.zone).filter(Boolean)
    )).sort();

    return {
      events: (tournaments ?? []).map((t: any) => ({
        id: t.id,
        date: t.tournament_date as string,
        time: t.tournament_time as string | null,
        game_id: t.game_id as string,
        game_name: t.games?.name ?? "—",
        game_slug: t.games?.slug ?? "",
        store_id: t.store_id as string,
        store_name: t.stores?.name ?? "—",
        store_city: t.stores?.city ?? "—",
        store_state: t.stores?.state ?? "—",
        zone: t.stores?.zone ?? "—",
      })),
      stores: stores ?? [],
      zones,
    };
  });

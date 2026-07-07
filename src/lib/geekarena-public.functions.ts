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
  .inputValidator(
    (d: {
      game_id?: string | null;
      zone?: string | null;
      store_id?: string | null;
      year: number;
      month: number;
    }) =>
      z
        .object({
          game_id: z.string().uuid().nullable().optional(),
          zone: z.string().nullable().optional(),
          store_id: z.string().uuid().nullable().optional(),
          year: z.number().int().min(2000).max(3000),
          month: z.number().int().min(1).max(12),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const admin = getGeekarenaAdmin();
    const pad = (n: number) => String(n).padStart(2, "0");
    const start = `${data.year}-${pad(data.month)}-01`;
    const endDate = new Date(data.year, data.month, 1);
    const end = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-01`;

    let q = admin
      .from("tournaments")
      .select(
        "id, tournament_date, store_id, game_id, stores(id, name, city, state, zone), games(id, name)",
      )
      .eq("status", "APPROVED")
      .gte("tournament_date", start)
      .lt("tournament_date", end)
      .order("tournament_date");

    if (data.game_id) q = q.eq("game_id", data.game_id);
    if (data.store_id) q = q.eq("store_id", data.store_id);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    let events = (rows ?? []).map((r: any) => {
      const store = Array.isArray(r.stores) ? r.stores[0] : r.stores;
      const game = Array.isArray(r.games) ? r.games[0] : r.games;
      return {
        id: r.id,
        date: String(r.tournament_date).slice(0, 10),
        start_time: null as string | null,
        store_id: store?.id ?? r.store_id,
        store_name: store?.name ?? "—",
        city: store?.city ?? "",
        state: store?.state ?? "",
        zone: store?.zone ?? "",
        game_id: game?.id ?? r.game_id,
        game_name: game?.name ?? "—",
      };
    });

    if (data.zone) events = events.filter((e) => e.zone === data.zone);

    const stores = Array.from(
      new Map(events.map((e) => [e.store_id, { id: e.store_id, name: e.store_name }])).values(),
    );
    const zones = Array.from(new Set(events.map((e) => e.zone).filter(Boolean)));

    return { events, stores, zones };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getGeekarenaAdmin } from "./geekarena-admin.server";

export const getPublicStores = createServerFn({ method: "POST" }).handler(async () => {
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
  for (const s of schedules ?? []) {
    const arr = gamesByStore.get(s.store_id) ?? [];
    if (s.games && !arr.some((g) => g.id === s.games.id)) arr.push(s.games);
    gamesByStore.set(s.store_id, arr);
  }

  return {
    stores: (stores ?? []).map((s: any) => ({
      ...s,
      games: gamesByStore.get(s.id) ?? [],
    })),
  };
});

export const getPublicStoreProfile = createServerFn({ method: "POST" })
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
    for (const s of schedules ?? []) {
      if (s.games && !games.some((g) => g.id === s.games.id)) games.push(s.games);
    }

    return { store: { ...store, games } };
  });

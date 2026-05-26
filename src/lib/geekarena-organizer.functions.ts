import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  requireGeekarenaOrganizer,
} from "./geekarena-auth.middleware";

function computeQualifying(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.getMonth() + 1; // 1..12
  const year = d.getFullYear();
  const semester = month <= 6 ? 1 : 2;
  return { qualifying_month: month, qualifying_semester: semester, qualifying_year: year };
}

// ---------- Mi Tienda ----------
export const getOrganizerOverview = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaOrganizer])
  .handler(async ({ context }) => {
    const { admin, player } = context;

    const [storesRes, gamesRes, homeStoreRes] = await Promise.all([
      admin
        .from("stores")
        .select("id, slug, name, city, state, country, is_active")
        .eq("is_active", true)
        .order("city", { ascending: true })
        .order("name", { ascending: true }),
      admin.from("games").select("id, slug, name, publisher, logo_url, is_active").eq("is_active", true).order("name"),
      player.home_store_id
        ? admin.from("stores").select("id, slug, name, city, state, country, is_active").eq("id", player.home_store_id).maybeSingle()
        : Promise.resolve({ data: null, error: null } as const),
    ]);

    if (storesRes.error) throw new Error(storesRes.error.message);
    if (gamesRes.error) throw new Error(gamesRes.error.message);
    if (homeStoreRes.error) throw new Error(homeStoreRes.error.message);

    return {
      player,
      stores: storesRes.data ?? [],
      games: gamesRes.data ?? [],
      homeStore: homeStoreRes.data ?? null,
    };
  });

export const updateHomeStore = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaOrganizer])
  .inputValidator((d: { store_id: string }) =>
    z.object({ store_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { error } = await admin
      .from("players")
      .update({ home_store_id: data.store_id })
      .eq("id", player.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateStoreInfo = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaOrganizer])
  .inputValidator((d: { store_id: string; name: string; city: string; state: string }) =>
    z.object({
      store_id: z.string().uuid(),
      name: z.string().min(1).max(120),
      city: z.string().max(120),
      state: z.string().max(120),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    if (player.home_store_id !== data.store_id && player.role !== "admin") {
      throw new Error("Solo puedes editar tu tienda asignada");
    }
    const { error } = await admin
      .from("stores")
      .update({ name: data.name, city: data.city || null, state: data.state || null })
      .eq("id", data.store_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Mis Torneos ----------
export const getMyTournaments = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaOrganizer])
  .handler(async ({ context }) => {
    const { admin, player } = context;
    if (!player.home_store_id) return { tournaments: [] };

    const { data: rows, error } = await admin
      .from("tournaments")
      .select("id, store_id, game_id, tournament_date, qualifying_month, qualifying_semester, qualifying_year, status, csv_url, approved_at, published_at, created_at")
      .eq("store_id", player.home_store_id)
      .order("tournament_date", { ascending: false });
    if (error) throw new Error(error.message);

    // join game names
    const gameIds = Array.from(new Set((rows ?? []).map((r) => r.game_id)));
    let gamesMap: Record<string, string> = {};
    if (gameIds.length > 0) {
      const { data: gms } = await admin.from("games").select("id, name").in("id", gameIds);
      gamesMap = Object.fromEntries((gms ?? []).map((g) => [g.id, g.name]));
    }

    return {
      tournaments: (rows ?? []).map((r) => ({ ...r, game_name: gamesMap[r.game_id] ?? "—" })),
    };
  });

export const deleteDraftTournament = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaOrganizer])
  .inputValidator((d: { tournament_id: string }) =>
    z.object({ tournament_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: t, error: te } = await admin
      .from("tournaments")
      .select("id, store_id, status")
      .eq("id", data.tournament_id)
      .maybeSingle();
    if (te) throw new Error(te.message);
    if (!t) throw new Error("Torneo no encontrado");
    if (t.store_id !== player.home_store_id && player.role !== "admin") {
      throw new Error("Este torneo no pertenece a tu tienda");
    }
    if (t.status !== "DRAFT" && player.role !== "admin") {
      throw new Error("Solo se pueden eliminar torneos en estado DRAFT");
    }
    const { error } = await admin.from("tournaments").delete().eq("id", data.tournament_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Subir Torneo ----------
export const createTournament = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaOrganizer])
  .inputValidator((d: {
    game_id: string;
    tournament_date: string; // YYYY-MM-DD
    csv_url?: string | null;
  }) =>
    z.object({
      game_id: z.string().uuid(),
      tournament_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      csv_url: z.string().url().max(2048).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    if (!player.home_store_id) {
      throw new Error("Primero asigna una tienda en 'Mi Tienda'");
    }
    const q = computeQualifying(data.tournament_date);
    const { data: created, error } = await admin
      .from("tournaments")
      .insert({
        store_id: player.home_store_id,
        game_id: data.game_id,
        tournament_date: data.tournament_date,
        ...q,
        status: "DRAFT",
        csv_url: data.csv_url ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

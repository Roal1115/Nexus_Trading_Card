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

    const baseCols = "id, store_id, game_id, tournament_date, qualifying_month, qualifying_semester, qualifying_year, status, csv_url, approved_at, published_at, created_at";
    let { data: rows, error } = await admin
      .from("tournaments")
      .select(baseCols + ", rejection_reason")
      .eq("store_id", player.home_store_id)
      .order("tournament_date", { ascending: false });
    if (error && /column .*rejection_reason.* does not exist/i.test(error.message)) {
      const retry = await admin
        .from("tournaments")
        .select(baseCols)
        .eq("store_id", player.home_store_id)
        .order("tournament_date", { ascending: false });
      rows = retry.data;
      error = retry.error;
    }
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

// ---------- Subir Torneo (DRAFT vacío, legacy) ----------
export const createTournament = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaOrganizer])
  .inputValidator((d: {
    game_id: string;
    tournament_date: string;
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

// ---------- Upload Tournament Results (CSV parsed client-side) ----------
const ResultRowSchema = z.object({
  rank: z.number().int().min(1),
  geek_tag: z.string().min(1).max(120),
  match_points: z.number().int().min(0).nullable(),
  omw_percentage: z.number().min(0).max(100).nullable(),
  wins: z.number().int().min(0).nullable(),
  losses: z.number().int().min(0).nullable(),
  draws: z.number().int().min(0).nullable(),
  points_earned: z.number().int().min(0),
});

export const uploadTournamentResults = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaOrganizer])
  .inputValidator((d: {
    store_id: string;
    game_id: string;
    tournament_date: string;
    rows: Array<z.infer<typeof ResultRowSchema>>;
  }) =>
    z.object({
      store_id: z.string().uuid(),
      game_id: z.string().uuid(),
      tournament_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      rows: z.array(ResultRowSchema).min(1).max(2000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    if (player.role !== "admin" && player.home_store_id !== data.store_id) {
      throw new Error("No puedes subir un torneo para esta tienda");
    }

    const { data: existing, error: dupErr } = await admin
      .from("tournaments")
      .select("id")
      .eq("store_id", data.store_id)
      .eq("game_id", data.game_id)
      .eq("tournament_date", data.tournament_date)
      .maybeSingle();
    if (dupErr) throw new Error(dupErr.message);
    if (existing) {
      throw new Error("Ya existe un torneo registrado para esta tienda, juego y fecha.");
    }

    const q = computeQualifying(data.tournament_date);
    const { data: tournament, error: te } = await admin
      .from("tournaments")
      .insert({
        store_id: data.store_id,
        game_id: data.game_id,
        tournament_date: data.tournament_date,
        ...q,
        status: "DRAFT",
      })
      .select("id")
      .single();
    if (te) throw new Error(te.message);
    const tournamentId = tournament.id;

    const cleanup = async (msg: string): Promise<never> => {
      await admin.from("tournament_results").delete().eq("tournament_id", tournamentId);
      await admin.from("tournaments").delete().eq("id", tournamentId);
      throw new Error(msg);
    };

    const tags = Array.from(new Set(data.rows.map((r) => r.geek_tag.trim())));
    const { data: existingPlayers, error: pe } = await admin
      .from("players")
      .select("id, geek_tag")
      .in("geek_tag", tags);
    if (pe) await cleanup(pe.message);

    const tagToId = new Map(
      (existingPlayers ?? []).map((p) => [p.geek_tag, p.id]),
    );
    const missingTags = tags.filter((t) => !tagToId.has(t));

    if (missingTags.length > 0) {
      const { data: created, error: ce } = await admin
        .from("players")
        .insert(
          missingTags.map((t) => ({
            geek_tag: t,
            is_active: true,
            role: "player",
          })),
        )
        .select("id, geek_tag");
      if (ce) await cleanup(ce.message);
      for (const p of created ?? []) tagToId.set(p.geek_tag, p.id);
    }

    const baseRows = data.rows.map((r) => {
      const pid = tagToId.get(r.geek_tag.trim());
      if (!pid) throw new Error(`No se pudo resolver el jugador ${r.geek_tag}`);
      return {
        tournament_id: tournamentId,
        player_id: pid,
        rank: r.rank,
        wins: r.wins,
        losses: r.losses,
        draws: r.draws ?? 0,
        points_earned: r.points_earned,
        match_points: r.match_points,
        omw_percentage: r.omw_percentage,
      };
    });

    let insertErr = (await admin.from("tournament_results").insert(baseRows)).error;
    if (insertErr && /column .* does not exist/i.test(insertErr.message)) {
      const stripped = baseRows.map(
        ({ match_points: _m, omw_percentage: _o, ...rest }) => rest,
      );
      insertErr = (await admin.from("tournament_results").insert(stripped)).error;
    }
    if (insertErr) await cleanup(insertErr.message);

    return {
      id: tournamentId,
      inserted: baseRows.length,
      created_players: missingTags.length,
    };
  });

// ---------- Stores list (organizer/admin) ----------
export const listActiveStores = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaOrganizer])
  .handler(async ({ context }) => {
    const { admin } = context;
    const { data, error } = await admin
      .from("stores")
      .select("id, name, city")
      .eq("is_active", true)
      .order("city", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { stores: data ?? [] };
  });

// ---------- Check existing player tags (for preview) ----------
export const lookupPlayerTags = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaOrganizer])
  .inputValidator((d: { tags: string[] }) =>
    z.object({ tags: z.array(z.string().min(1).max(120)).min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const { data: rows, error } = await admin
      .from("players")
      .select("geek_tag")
      .in("geek_tag", data.tags);
    if (error) throw new Error(error.message);
    return { existing: (rows ?? []).map((r) => r.geek_tag) };
  });

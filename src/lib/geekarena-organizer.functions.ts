import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  requireGeekarenaOrganizer,
} from "./geekarena-auth.middleware";
import { getGeekarenaAdmin } from "./geekarena-admin.server";

function normalizeId(id: string): string {
  const stripped = id.replace(/^0+/, "");
  return stripped === "" ? "0" : stripped;
}

async function resolvePlayer(
  admin: ReturnType<typeof getGeekarenaAdmin>,
  geekTag: string,
  membershipId: string | null,
  gameId: string,
): Promise<{ id: string; isNew: boolean }> {
  // 1. Try TCG ID (normalized) first
  if (membershipId) {
    const normalizedInput = normalizeId(membershipId);
    const { data: byId } = await admin
      .from("player_tcg_ids")
      .select("player_id")
      .eq("game_id", gameId)
      .eq("tcg_user_id_normalized", normalizedInput)
      .maybeSingle();
    if (byId?.player_id) {
      return { id: byId.player_id as string, isNew: false };
    }
  }

  // 2. Fall back to geek_tag
  const { data: byTag } = await admin
    .from("players")
    .select("id")
    .eq("geek_tag", geekTag)
    .maybeSingle();
  if (byTag?.id) {
    return { id: byTag.id as string, isNew: false };
  }

  // 3. Auto-create
  const { data: newPlayer, error } = await admin
    .from("players")
    .insert({
      geek_tag: geekTag,
      is_active: true,
      role: "player",
    })
    .select("id")
    .single();
  if (error || !newPlayer) {
    throw new Error(`No se pudo crear el jugador: ${geekTag}`);
  }

  if (membershipId && newPlayer.id) {
    await admin
      .from("player_tcg_ids")
      .upsert(
        {
          player_id: newPlayer.id,
          game_id: gameId,
          tcg_user_id: membershipId,
          tcg_user_id_normalized: normalizeId(membershipId),
        },
        { onConflict: "player_id,game_id", ignoreDuplicates: true },
      );
  }

  return { id: newPlayer.id as string, isNew: true };
}

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
  .inputValidator((d: {
    status?: string;
    game_id?: string;
    date_from?: string;
    date_to?: string;
  }) =>
    z.object({
      status: z.string().optional(),
      game_id: z.string().optional(),
      date_from: z.string().optional(),
      date_to: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    if (!player.home_store_id)
      return { tournaments: [], store_name: null, stats: {} as Record<string, number> };

    const { data: store } = await admin
      .from("stores")
      .select("name, city")
      .eq("id", player.home_store_id)
      .maybeSingle();

    const baseCols =
      "id, game_id, tournament_date, status, csv_url, approved_at, published_at, created_at";
    const extraCols = ", rejection_reason, approved_by";

    let rows: any[] | null = null;
    let err: { message: string } | null = null;
    {
      let q = admin
        .from("tournaments")
        .select(baseCols + extraCols)
        .eq("store_id", player.home_store_id)
        .order("tournament_date", { ascending: false });
      if (data.status) q = q.eq("status", data.status);
      if (data.game_id) q = q.eq("game_id", data.game_id);
      if (data.date_from) q = q.gte("tournament_date", data.date_from);
      if (data.date_to) q = q.lte("tournament_date", data.date_to);
      const res = await q;
      rows = res.data as any[] | null;
      err = res.error;
    }
    if (err && /column .* does not exist/i.test(err.message)) {
      let q = admin
        .from("tournaments")
        .select(baseCols)
        .eq("store_id", player.home_store_id)
        .order("tournament_date", { ascending: false });
      if (data.status) q = q.eq("status", data.status);
      if (data.game_id) q = q.eq("game_id", data.game_id);
      if (data.date_from) q = q.gte("tournament_date", data.date_from);
      if (data.date_to) q = q.lte("tournament_date", data.date_to);
      const res = await q;
      rows = res.data as any[] | null;
      err = res.error;
    }
    if (err) throw new Error(err.message);

    const tournamentIds = (rows ?? []).map((r) => r.id);
    const gameIds = Array.from(new Set((rows ?? []).map((r) => r.game_id)));
    const approverIds = Array.from(
      new Set(
        (rows ?? [])
          .filter((r) => r.approved_by)
          .map((r) => r.approved_by as string),
      ),
    );

    const [gmsRes, approversRes, resultsRes] = await Promise.all([
      gameIds.length
        ? admin.from("games").select("id, name").in("id", gameIds)
        : Promise.resolve({ data: [] as any[] }),
      approverIds.length
        ? admin.from("players").select("id, geek_tag").in("id", approverIds)
        : Promise.resolve({ data: [] as any[] }),
      tournamentIds.length
        ? admin
            .from("tournament_results")
            .select("tournament_id")
            .in("tournament_id", tournamentIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const gamesMap = Object.fromEntries(
      (gmsRes.data ?? []).map((g: any) => [g.id, g.name]),
    );
    const approversMap = Object.fromEntries(
      (approversRes.data ?? []).map((p: any) => [p.id, p.geek_tag]),
    );
    const participantMap = (resultsRes.data ?? []).reduce(
      (acc: Record<string, number>, r: any) => {
        acc[r.tournament_id] = (acc[r.tournament_id] ?? 0) + 1;
        return acc;
      },
      {},
    );

    const stats = (rows ?? []).reduce(
      (acc: Record<string, number>, t: any) => {
        const key = t.rejection_reason && t.status === "DRAFT" ? "REJECTED" : t.status;
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      },
      {},
    );

    return {
      store_name: store ? `${store.name} — ${store.city ?? ""}`.trim() : null,
      stats,
      tournaments: (rows ?? []).map((r: any) => ({
        ...r,
        game_name: gamesMap[r.game_id] ?? "—",
        approved_by_tag: r.approved_by ? approversMap[r.approved_by] ?? "—" : null,
        participants: participantMap[r.id] ?? 0,
      })),
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
  membership_id: z.string().max(120).nullable().optional(),
  match_points: z.number().int().min(0).nullable(),
  omw_percentage: z.number().min(0).max(100).nullable(),
  wins: z.number().int().min(0).nullable(),
  losses: z.number().int().min(0).nullable(),
  draws: z.number().int().min(0).nullable(),
  points_earned: z.number().min(0),
});

export const uploadTournamentResults = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaOrganizer])
  .inputValidator((d: {
    store_id: string;
    game_id: string;
    tournament_date: string;
    rows: Array<z.infer<typeof ResultRowSchema>>;
    tournament_id?: string;
    csv_url?: string | null;
  }) =>
    z.object({
      store_id: z.string().uuid(),
      game_id: z.string().uuid(),
      tournament_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      rows: z.array(ResultRowSchema).min(1).max(2000),
      tournament_id: z.string().uuid().optional(),
      csv_url: z.string().url().max(2048).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    if (player.role !== "admin" && player.home_store_id !== data.store_id) {
      throw new Error("No puedes subir un torneo para esta tienda");
    }

    // Restringir fecha a la semana actual (lunes → hoy). Admin puede saltar la validación.
    if (player.role !== "admin") {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const dayOfWeek = today.getDay();
      const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(today);
      monday.setDate(today.getDate() - daysSinceMonday);
      monday.setHours(0, 0, 0, 0);
      const tDate = new Date(data.tournament_date + "T12:00:00");
      if (tDate > today) {
        throw new Error("No se pueden subir torneos con fecha futura.");
      }
      if (tDate < monday) {
        throw new Error(
          `Solo se pueden subir torneos de la semana actual (desde el ${monday.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}).`,
        );
      }
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
      return {
        ok: false as const,
        reason: "duplicate" as const,
        message:
          "Ya existe un torneo registrado para esta tienda, juego y fecha.",
      };
    }

    const q = computeQualifying(data.tournament_date);
    const insertPayload: Record<string, unknown> = {
      store_id: data.store_id,
      game_id: data.game_id,
      tournament_date: data.tournament_date,
      ...q,
      status: "DRAFT",
      csv_url: data.csv_url ?? null,
    };
    if (data.tournament_id) insertPayload.id = data.tournament_id;
    const { data: tournament, error: te } = await admin
      .from("tournaments")
      .insert(insertPayload)
      .select("id")
      .single();
    if (te) throw new Error(te.message);
    const tournamentId = tournament.id;

    const cleanup = async (msg: string): Promise<never> => {
      await admin.from("tournament_results").delete().eq("tournament_id", tournamentId);
      await admin.from("tournaments").delete().eq("id", tournamentId);
      throw new Error(msg);
    };

    const baseRows: Array<{
      tournament_id: string;
      player_id: string;
      rank: number;
      wins: number | null;
      losses: number | null;
      draws: number;
      points_earned: number;
      match_points: number | null;
      omw_percentage: number | null;
    }> = [];
    let createdPlayers = 0;

    try {
      for (const r of data.rows) {
        const { id: playerId, isNew } = await resolvePlayer(
          admin,
          r.geek_tag.trim(),
          r.membership_id ? r.membership_id.trim() || null : null,
          data.game_id,
        );
        if (isNew) createdPlayers++;
        baseRows.push({
          tournament_id: tournamentId,
          player_id: playerId,
          rank: r.rank,
          wins: r.wins,
          losses: r.losses,
          draws: r.draws ?? 0,
          points_earned: r.points_earned,
          match_points: r.match_points,
          omw_percentage: r.omw_percentage,
        });
      }
    } catch (e) {
      await cleanup((e as Error).message);
    }


    let insertErr = (await admin.from("tournament_results").insert(baseRows)).error;
    if (insertErr && /column .* does not exist/i.test(insertErr.message)) {
      const stripped = baseRows.map(
        ({ match_points: _m, omw_percentage: _o, ...rest }) => rest,
      );
      insertErr = (await admin.from("tournament_results").insert(stripped)).error;
    }
    if (insertErr) await cleanup(insertErr.message);

    return {
      ok: true as const,
      id: tournamentId,
      inserted: baseRows.length,
      created_players: createdPlayers,
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

// ---------- Badge counts ----------
export const getOrganizerBadgeCounts = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaOrganizer])
  .handler(async ({ context }) => {
    const { admin, player } = context;

    if (!player.home_store_id) return { pending: 0, approved: 0 };

    const [pending, approved] = await Promise.all([
      admin
        .from("tournaments")
        .select("*", { count: "exact", head: true })
        .eq("store_id", player.home_store_id)
        .eq("status", "DRAFT"),
      admin
        .from("tournaments")
        .select("*", { count: "exact", head: true })
        .eq("store_id", player.home_store_id)
        .eq("status", "APPROVED"),
    ]);

    return {
      pending: pending.count ?? 0,
      approved: approved.count ?? 0,
    };
  });

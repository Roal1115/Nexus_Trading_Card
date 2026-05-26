import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getGeekarenaAdmin } from "./geekarena-admin.server";

// ---------- helpers ----------
async function requireAdmin(email: string) {
  const admin = getGeekarenaAdmin();
  const { data, error } = await admin
    .from("players")
    .select("id, geek_tag, email, role")
    .eq("email", email)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Jugador no encontrado");
  if (data.role !== "admin") throw new Error("No autorizado");
  return { admin, player: data };
}

function tfValues(month: number, semester: number, year: number) {
  return {
    MONTH: `${year}-${String(month).padStart(2, "0")}`,
    SEMESTER: `${year}-S${semester}`,
    YEAR: `${year}`,
  } as const;
}

// Recompute leaderboard snapshots for a given game+timeframe based on
// PUBLISHED tournaments in that period.
async function recomputeSnapshot(
  admin: ReturnType<typeof getGeekarenaAdmin>,
  game_id: string,
  timeframe_type: "MONTH" | "SEMESTER" | "YEAR",
  timeframe_value: string,
  filter: { year?: number; month?: number; semester?: number },
) {
  // fetch published tournaments matching the filter
  let q = admin
    .from("tournaments")
    .select("id, qualifying_year, qualifying_month, qualifying_semester")
    .eq("status", "PUBLISHED")
    .eq("game_id", game_id);
  if (filter.year != null) q = q.eq("qualifying_year", filter.year);
  if (filter.month != null) q = q.eq("qualifying_month", filter.month);
  if (filter.semester != null) q = q.eq("qualifying_semester", filter.semester);

  const { data: tournaments, error: te } = await q;
  if (te) throw new Error(te.message);
  const tIds = (tournaments ?? []).map((t) => t.id);

  // delete previous snapshot rows for this slice
  const { error: de } = await admin
    .from("leaderboard_snapshots")
    .delete()
    .eq("game_id", game_id)
    .eq("timeframe_type", timeframe_type)
    .eq("timeframe_value", timeframe_value);
  if (de) throw new Error(de.message);

  if (tIds.length === 0) return;

  const { data: results, error: re } = await admin
    .from("tournament_results")
    .select("player_id, rank, points_earned")
    .in("tournament_id", tIds);
  if (re) throw new Error(re.message);

  type Agg = { total_points: number; played: number; won: number };
  const agg = new Map<string, Agg>();
  for (const r of results ?? []) {
    const a = agg.get(r.player_id) ?? { total_points: 0, played: 0, won: 0 };
    a.total_points += r.points_earned ?? 0;
    a.played += 1;
    if (r.rank === 1) a.won += 1;
    agg.set(r.player_id, a);
  }

  const ranked = Array.from(agg.entries())
    .map(([player_id, a]) => ({ player_id, ...a }))
    .sort((a, b) => b.total_points - a.total_points);

  const rows = ranked.map((r, i) => ({
    player_id: r.player_id,
    game_id,
    timeframe_type,
    timeframe_value,
    total_points: r.total_points,
    tournaments_played: r.played,
    tournaments_won: r.won,
    rank_position: i + 1,
    last_updated_at: new Date().toISOString(),
  }));

  if (rows.length === 0) return;
  const { error: ie } = await admin.from("leaderboard_snapshots").insert(rows);
  if (ie) throw new Error(ie.message);
}

// ---------- Torneos pendientes / aprobados ----------
export const listTournamentsByStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; statuses: string[] }) =>
    z.object({
      email: z.string().email(),
      statuses: z.array(z.string()).min(1).max(6),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { admin } = await requireAdmin(data.email);
    const { data: rows, error } = await admin
      .from("tournaments")
      .select(
        "id, store_id, game_id, tournament_date, qualifying_month, qualifying_semester, qualifying_year, status, csv_url, approved_at, published_at, created_at",
      )
      .in("status", data.statuses)
      .order("tournament_date", { ascending: false });
    if (error) throw new Error(error.message);

    const gameIds = Array.from(new Set((rows ?? []).map((r) => r.game_id)));
    const storeIds = Array.from(new Set((rows ?? []).map((r) => r.store_id)));
    const [gms, sts] = await Promise.all([
      gameIds.length
        ? admin.from("games").select("id, name").in("id", gameIds)
        : Promise.resolve({ data: [], error: null } as const),
      storeIds.length
        ? admin.from("stores").select("id, name, city, state").in("id", storeIds)
        : Promise.resolve({ data: [], error: null } as const),
    ]);
    const gMap = Object.fromEntries((gms.data ?? []).map((g) => [g.id, g.name]));
    const sMap = Object.fromEntries(
      (sts.data ?? []).map((s) => [
        s.id,
        { name: s.name, city: s.city, state: s.state },
      ]),
    );

    return {
      tournaments: (rows ?? []).map((r) => ({
        ...r,
        game_name: gMap[r.game_id] ?? "—",
        store: sMap[r.store_id] ?? { name: "—", city: null, state: null },
      })),
    };
  });

export const approveTournament = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; tournament_id: string }) =>
    z.object({
      email: z.string().email(),
      tournament_id: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { admin } = await requireAdmin(data.email);
    const { error } = await admin
      .from("tournaments")
      .update({ status: "APPROVED", approved_at: new Date().toISOString() })
      .eq("id", data.tournament_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rejectTournament = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; tournament_id: string }) =>
    z.object({
      email: z.string().email(),
      tournament_id: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { admin } = await requireAdmin(data.email);
    const { error } = await admin
      .from("tournaments")
      .update({ status: "REJECTED" })
      .eq("id", data.tournament_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const publishTournaments = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; tournament_ids: string[] }) =>
    z.object({
      email: z.string().email(),
      tournament_ids: z.array(z.string().uuid()).min(1).max(200),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { admin } = await requireAdmin(data.email);
    const { data: tournaments, error: te } = await admin
      .from("tournaments")
      .select("id, game_id, qualifying_year, qualifying_month, qualifying_semester, status")
      .in("id", data.tournament_ids);
    if (te) throw new Error(te.message);

    const publishable = (tournaments ?? []).filter(
      (t) => t.status === "APPROVED" || t.status === "DRAFT",
    );
    if (publishable.length === 0) {
      throw new Error("No hay torneos publicables en la selección");
    }

    const nowIso = new Date().toISOString();
    const { error: ue } = await admin
      .from("tournaments")
      .update({ status: "PUBLISHED", published_at: nowIso, approved_at: nowIso })
      .in("id", publishable.map((t) => t.id));
    if (ue) throw new Error(ue.message);

    // recompute snapshots for each (game, timeframe) slice impacted
    const slices = new Set<string>();
    for (const t of publishable) {
      const tf = tfValues(t.qualifying_month, t.qualifying_semester, t.qualifying_year);
      slices.add(`${t.game_id}|MONTH|${tf.MONTH}|y=${t.qualifying_year}|m=${t.qualifying_month}`);
      slices.add(`${t.game_id}|SEMESTER|${tf.SEMESTER}|y=${t.qualifying_year}|s=${t.qualifying_semester}`);
      slices.add(`${t.game_id}|YEAR|${tf.YEAR}|y=${t.qualifying_year}`);
    }

    for (const key of slices) {
      const [game_id, type, value, ...rest] = key.split("|");
      const filter: { year?: number; month?: number; semester?: number } = {};
      for (const p of rest) {
        const [k, v] = p.split("=");
        if (k === "y") filter.year = Number(v);
        if (k === "m") filter.month = Number(v);
        if (k === "s") filter.semester = Number(v);
      }
      await recomputeSnapshot(
        admin,
        game_id,
        type as "MONTH" | "SEMESTER" | "YEAR",
        value,
        filter,
      );
    }

    return { published: publishable.length };
  });

// ---------- Stores ----------
export const listStoresWithOrganizers = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string }) =>
    z.object({ email: z.string().email() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { admin } = await requireAdmin(data.email);
    const [storesRes, playersRes] = await Promise.all([
      admin.from("stores").select("id, slug, name, city, state, is_active").order("name"),
      admin.from("players").select("id, geek_tag, email, role, home_store_id").in("role", ["organizer", "admin"]),
    ]);
    if (storesRes.error) throw new Error(storesRes.error.message);
    if (playersRes.error) throw new Error(playersRes.error.message);

    return {
      stores: storesRes.data ?? [],
      organizers: playersRes.data ?? [],
    };
  });

export const createStore = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; slug: string; name: string; city?: string; state?: string }) =>
    z.object({
      email: z.string().email(),
      slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/i),
      name: z.string().min(1).max(120),
      city: z.string().max(120).optional(),
      state: z.string().max(120).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { admin } = await requireAdmin(data.email);
    const { error } = await admin.from("stores").insert({
      slug: data.slug.toLowerCase(),
      name: data.name,
      city: data.city || null,
      state: data.state || null,
      country: "MX",
      is_active: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Players ----------
export const listPlayers = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; search?: string }) =>
    z.object({
      email: z.string().email(),
      search: z.string().max(120).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { admin } = await requireAdmin(data.email);
    let q = admin
      .from("players")
      .select("id, geek_tag, display_name, email, role, home_store_id, is_active, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.search) {
      q = q.or(
        `geek_tag.ilike.%${data.search}%,email.ilike.%${data.search}%,display_name.ilike.%${data.search}%`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { players: rows ?? [] };
  });

export const setPlayerRole = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; player_id: string; role: "player" | "organizer" | "admin"; home_store_id?: string | null }) =>
    z.object({
      email: z.string().email(),
      player_id: z.string().uuid(),
      role: z.enum(["player", "organizer", "admin"]),
      home_store_id: z.string().uuid().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { admin } = await requireAdmin(data.email);
    const update: Record<string, unknown> = { role: data.role };
    if (data.home_store_id !== undefined) update.home_store_id = data.home_store_id;
    const { error } = await admin
      .from("players")
      .update(update)
      .eq("id", data.player_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

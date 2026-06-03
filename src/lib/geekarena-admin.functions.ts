import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getGeekarenaAdmin } from "./geekarena-admin.server";
import { requireGeekarenaAdmin } from "./geekarena-auth.middleware";

function tfValues(month: number, semester: number, year: number) {
  return {
    MONTH: `${year}-${String(month).padStart(2, "0")}`,
    SEMESTER: `${year}-S${semester}`,
  } as const;
}

// Returns ISO week key "YYYY-WNN" for a given date string "YYYY-MM-DD"
// Week starts on Monday
function getWeekKey(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00Z");
  const day = date.getUTCDay(); // 0=Sun, 1=Mon ... 6=Sat
  const diff = (day === 0 ? -6 : 1 - day); // adjust to Monday
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diff);
  const year = monday.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const weekNum = Math.ceil(
    ((monday.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7
  );
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}

// Recompute leaderboard snapshots for a given game+timeframe based on
// PUBLISHED tournaments in that period.
async function recomputeSnapshot(
  admin: ReturnType<typeof getGeekarenaAdmin>,
  game_id: string,
  store_id: string,
  timeframe_type: "MONTHLY" | "SEMESTRAL",
  timeframe_value: string,
  filter: { year?: number; month?: number; semester?: number },
) {
  let q = admin
    .from("tournaments")
    .select("id, store_id, tournament_date, qualifying_year, qualifying_month, qualifying_semester")
    .eq("status", "PUBLISHED")
    .eq("game_id", game_id)
    .eq("store_id", store_id);
  if (filter.year != null) q = q.eq("qualifying_year", filter.year);
  if (filter.month != null) q = q.eq("qualifying_month", filter.month);
  if (filter.semester != null) q = q.eq("qualifying_semester", filter.semester);

  const { data: tournaments, error: te } = await q;
  if (te) throw new Error(te.message);
  const tIds = (tournaments ?? []).map((t) => t.id);

  const { error: de } = await admin
    .from("leaderboard_snapshots")
    .delete()
    .eq("game_id", game_id)
    .eq("store_id", store_id)
    .eq("timeframe_type", timeframe_type)
    .eq("timeframe_value", timeframe_value);
  if (de) throw new Error(de.message);

  if (tIds.length === 0) return;

  const { data: results, error: re } = await admin
    .from("tournament_results")
    .select("player_id, rank, points_earned, omw_percentage, tournament_id")
    .in("tournament_id", tIds);
  if (re) throw new Error(re.message);

  // Build a map from tournament_id -> tournament_date
  const tournamentDateMap = new Map<string, string>(
    (tournaments ?? []).map((t) => [t.id, t.tournament_date])
  );

  // Group results by player_id -> week -> list of results
  type RawResult = {
    player_id: string;
    rank: number | null;
    points_earned: number | null;
    omw_percentage: number | null;
    tournament_id: string;
  };

  const playerWeekMap = new Map<string, Map<string, RawResult[]>>();

  for (const r of (results ?? []) as RawResult[]) {
    const date = tournamentDateMap.get(r.tournament_id);
    if (!date) continue;
    const weekKey = getWeekKey(date);

    if (!playerWeekMap.has(r.player_id)) {
      playerWeekMap.set(r.player_id, new Map());
    }
    const weekMap = playerWeekMap.get(r.player_id)!;
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, []);
    }
    weekMap.get(weekKey)!.push(r);
  }

  // For each player, apply top-2-per-week rule and aggregate
  type Agg = {
    total_points: number;
    played: number;
    won: number;
    omw_sum: number;
    omw_count: number;
  };
  const agg = new Map<string, Agg>();

  for (const [player_id, weekMap] of playerWeekMap.entries()) {
    const a: Agg = { total_points: 0, played: 0, won: 0, omw_sum: 0, omw_count: 0 };

    for (const weekResults of weekMap.values()) {
      const top2 = weekResults
        .sort((x, y) => (y.points_earned ?? 0) - (x.points_earned ?? 0))
        .slice(0, 2);

      for (const r of top2) {
        a.total_points += r.points_earned ?? 0;
        a.played += 1;
        if (r.rank === 1) a.won += 1;
        if (r.omw_percentage != null) {
          a.omw_sum += Number(r.omw_percentage);
          a.omw_count += 1;
        }
      }
    }

    agg.set(player_id, a);
  }


  const ranked = Array.from(agg.entries())
    .map(([player_id, a]) => ({ player_id, ...a }))
    .sort((a, b) => b.total_points - a.total_points);

  const rows = ranked.map((r, i) => ({
    player_id: r.player_id,
    game_id,
    store_id,
    timeframe_type,
    timeframe_value,
    total_points: r.total_points,
    tournaments_played: r.played,
    tournaments_won: r.won,
    omw_percentage:
      r.omw_count > 0
        ? Math.round((r.omw_sum / r.omw_count) * 100) / 100
        : 0,
    rank_position: i + 1,
    last_updated_at: new Date().toISOString(),
  }));

  if (rows.length === 0) return;
  const { error: ie } = await admin.from("leaderboard_snapshots").insert(rows);
  if (ie) throw new Error(ie.message);
}

// ---------- Torneos pendientes / aprobados ----------
export const listTournamentsByStatus = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { statuses: string[] }) =>
    z.object({
      statuses: z.array(z.string()).min(1).max(6),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
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
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { tournament_id: string }) =>
    z.object({
      tournament_id: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const now = new Date();
    const undoDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const { error } = await admin
      .from("tournaments")
      .update({
        status: "APPROVED",
        approved_at: now.toISOString(),
        undo_deadline: undoDeadline.toISOString(),
      })
      .eq("id", data.tournament_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rejectTournament = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { tournament_id: string }) =>
    z.object({
      tournament_id: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const { error } = await admin
      .from("tournaments")
      .update({
        status: "DRAFT",
        approved_at: null,
        undo_deadline: null,
      })
      .eq("id", data.tournament_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const publishTournaments = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { tournament_ids: string[] }) =>
    z.object({
      tournament_ids: z.array(z.string().uuid()).min(1).max(200),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const { data: tournaments, error: te } = await admin
      .from("tournaments")
      .select("id, store_id, game_id, qualifying_year, qualifying_month, qualifying_semester, status")
      .in("id", data.tournament_ids);
    if (te) throw new Error(te.message);

    const publishable = (tournaments ?? []).filter(
      (t) => t.status === "APPROVED",
    );
    if (publishable.length === 0) {
      return { published: 0 };
    }

    const nowIso = new Date().toISOString();
    const { error: ue } = await admin
      .from("tournaments")
      .update({ status: "PUBLISHED", published_at: nowIso, approved_at: nowIso })
      .in("id", publishable.map((t) => t.id));
    if (ue) throw new Error(ue.message);

    const slices = new Set<string>();
    for (const t of publishable) {
      const tf = tfValues(t.qualifying_month, t.qualifying_semester, t.qualifying_year);
      slices.add(`${t.game_id}|${t.store_id}|MONTHLY|${tf.MONTH}|y=${t.qualifying_year}|m=${t.qualifying_month}`);
      slices.add(`${t.game_id}|${t.store_id}|SEMESTRAL|${tf.SEMESTER}|y=${t.qualifying_year}|s=${t.qualifying_semester}`);
    }

    for (const key of slices) {
      const [game_id, store_id, type, value, ...rest] = key.split("|");
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
        store_id,
        type as "MONTHLY" | "SEMESTRAL",
        value,
        filter,
      );
    }

    return { published: publishable.length };
  });

// ---------- Stores ----------
export const listStoresWithOrganizers = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .handler(async ({ context }) => {
    const { admin } = context;
    const [storesRes, playersRes] = await Promise.all([
      admin
        .from("stores")
        .select("id, slug, name, city, state, is_active")
        .order("city", { ascending: true })
        .order("name", { ascending: true }),
      admin.from("players").select("id, geek_tag, email, role, home_store_id").in("role", ["organizer", "admin"]),
    ]);
    if (storesRes.error) throw new Error(storesRes.error.message);
    if (playersRes.error) throw new Error(playersRes.error.message);

    return {
      stores: storesRes.data ?? [],
      organizers: playersRes.data ?? [],
    };
  });

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export const createStore = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { name: string; city?: string; state?: string; slug?: string }) =>
    z.object({
      name: z.string().min(1).max(120),
      city: z.string().max(120).optional(),
      state: z.string().max(120).optional(),
      slug: z.string().max(80).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const slug = (data.slug && data.slug.trim()) ? slugify(data.slug) : slugify(data.name);
    if (!slug) throw new Error("Nombre inválido para generar slug");
    const { error } = await admin.from("stores").insert({
      slug,
      name: data.name,
      city: data.city || null,
      state: data.state || null,
      country: "MX",
      is_active: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setStoreActive = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { store_id: string; is_active: boolean }) =>
    z.object({
      store_id: z.string().uuid(),
      is_active: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const { error } = await admin
      .from("stores")
      .update({ is_active: data.is_active })
      .eq("id", data.store_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Players ----------
const PAGE_SIZE = 25;

export const listPlayers = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator(
    (d: {
      search?: string;
      role?: "all" | "player" | "organizer" | "admin";
      active?: "all" | "true" | "false";
      store_id?: string | null;
      sort?: "recent" | "geek_tag" | "points";
      page?: number;
      include_last_sign_in?: boolean;
    }) =>
      z
        .object({
          search: z.string().max(120).optional(),
          role: z.enum(["all", "player", "organizer", "admin"]).optional(),
          active: z.enum(["all", "true", "false"]).optional(),
          store_id: z.string().uuid().optional().nullable(),
          sort: z.enum(["recent", "geek_tag", "points"]).optional(),
          page: z.number().int().min(1).max(10000).optional(),
          include_last_sign_in: z.boolean().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const page = data.page ?? 1;
    const sort = data.sort ?? "recent";

    let orderedIdsByPoints: string[] | null = null;
    if (sort === "points") {
      const { data: snaps, error: se } = await admin
        .from("leaderboard_snapshots")
        .select("player_id, total_points")
        .eq("timeframe_type", "SEMESTRAL");
      if (se) throw new Error(se.message);
      const sum = new Map<string, number>();
      for (const s of snaps ?? []) {
        sum.set(s.player_id, (sum.get(s.player_id) ?? 0) + (s.total_points ?? 0));
      }
      orderedIdsByPoints = Array.from(sum.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id);
    }

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let q = admin
      .from("players")
      .select(
        "id, geek_tag, display_name, email, role, home_store_id, is_active, created_at",
        { count: "exact" },
      );

    if (data.role && data.role !== "all") q = q.eq("role", data.role);
    if (data.active && data.active !== "all") q = q.eq("is_active", data.active === "true");
    if (data.store_id) q = q.eq("home_store_id", data.store_id);

    if (data.search) {
      const term = data.search.trim();
      if (term.length > 0) {
        const safe = term.replace(/[%,()]/g, "");
        if (safe.includes("@")) {
          q = q.ilike("email", `%${safe}%`);
        } else {
          q = q.ilike("geek_tag", `%${safe}%`);
        }
      }
    }

    if (sort === "points" && orderedIdsByPoints) {
      const idsForPage = orderedIdsByPoints.slice(from, to + 1);
      if (idsForPage.length === 0) {
        const { count } = await q;
        return { players: [], total: count ?? 0, page, page_size: PAGE_SIZE };
      }
      q = q.in("id", idsForPage);
      const { data: rows, error, count } = await q;
      if (error) throw new Error(error.message);
      const map = new Map((rows ?? []).map((r) => [r.id, r]));
      const ordered = idsForPage.map((id) => map.get(id)).filter(Boolean);
      return await withLastSignIn(admin, ordered, {
        total: count ?? ordered.length,
        page,
        include: data.include_last_sign_in,
      });
    }

    if (sort === "geek_tag") {
      q = q.order("geek_tag", { ascending: true });
    } else {
      q = q.order("created_at", { ascending: false });
    }
    q = q.range(from, to);

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);

    return await withLastSignIn(admin, rows ?? [], {
      total: count ?? 0,
      page,
      include: data.include_last_sign_in,
    });
  });

async function withLastSignIn(
  admin: ReturnType<typeof getGeekarenaAdmin>,
  rows: any[],
  meta: { total: number; page: number; include?: boolean },
) {
  let enriched = rows;
  if (meta.include) {
    enriched = await Promise.all(
      rows.map(async (r) => {
        if (!r?.email) return { ...r, last_sign_in_at: null };
        try {
          const { data } = await (admin as any).auth.admin.listUsers({
            page: 1,
            perPage: 1,
          });
          const u = (data?.users ?? []).find((x: any) => x.email === r.email);
          return { ...r, last_sign_in_at: u?.last_sign_in_at ?? null };
        } catch {
          return { ...r, last_sign_in_at: null };
        }
      }),
    );
  }
  return {
    players: enriched,
    total: meta.total,
    page: meta.page,
    page_size: PAGE_SIZE,
  };
}

export const setPlayerActive = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { player_id: string; is_active: boolean }) =>
    z
      .object({
        player_id: z.string().uuid(),
        is_active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const { error } = await admin
      .from("players")
      .update({ is_active: data.is_active })
      .eq("id", data.player_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPlayerDetail = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { player_id: string }) =>
    z
      .object({
        player_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const { data: player, error: pe } = await admin
      .from("players")
      .select(
        "id, geek_tag, display_name, email, avatar_url, role, home_store_id, is_active, created_at",
      )
      .eq("id", data.player_id)
      .maybeSingle();
    if (pe) throw new Error(pe.message);
    if (!player) throw new Error("Jugador no encontrado");

    const [storeRes, resultsRes, snapsRes] = await Promise.all([
      player.home_store_id
        ? admin.from("stores").select("id, name, city, state").eq("id", player.home_store_id).maybeSingle()
        : Promise.resolve({ data: null, error: null } as const),
      admin
        .from("tournament_results")
        .select("tournament_id, rank, wins, losses, points_earned")
        .eq("player_id", data.player_id),
      admin
        .from("leaderboard_snapshots")
        .select("game_id, timeframe_type, timeframe_value, total_points, rank_position")
        .eq("player_id", data.player_id)
        .eq("timeframe_type", "SEMESTRAL")
        .order("timeframe_value", { ascending: false }),
    ]);

    const tIds = Array.from(new Set((resultsRes.data ?? []).map((r) => r.tournament_id)));
    const { data: tournaments } = tIds.length
      ? await admin
          .from("tournaments")
          .select("id, tournament_date, game_id, store_id")
          .in("id", tIds)
      : { data: [] as any[] };

    const totalPoints = (resultsRes.data ?? []).reduce(
      (s, r) => s + (r.points_earned ?? 0),
      0,
    );
    const wins = (resultsRes.data ?? []).filter((r) => r.rank === 1).length;

    return {
      player,
      store: storeRes.data ?? null,
      tournaments_played: tIds.length,
      tournaments_won: wins,
      total_points: totalPoints,
      results: resultsRes.data ?? [],
      tournaments: tournaments ?? [],
      yearly_snapshots: snapsRes.data ?? [],
    };
  });

export const setPlayerRole = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { player_id: string; role: "player" | "organizer" | "admin"; home_store_id?: string | null }) =>
    z.object({
      player_id: z.string().uuid(),
      role: z.enum(["player", "organizer", "admin"]),
      home_store_id: z.string().uuid().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const update: Record<string, unknown> = { role: data.role };
    if (data.home_store_id !== undefined) update.home_store_id = data.home_store_id;
    const { error } = await admin
      .from("players")
      .update(update)
      .eq("id", data.player_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Detalle de torneo (admin review) ----------
type Alert = {
  level: "CRITICAL" | "WARNING";
  message: string;
  link?: { to: string; label: string } | null;
};

export const getTournamentDetail = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { tournament_id: string }) =>
    z.object({ tournament_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;

    const { data: t, error: te } = await admin
      .from("tournaments")
      .select(
        "id, store_id, game_id, status, tournament_date, qualifying_month, qualifying_semester, qualifying_year, approved_at, undo_deadline, published_at, created_at, rejection_reason",
      )
      .eq("id", data.tournament_id)
      .maybeSingle();
    if (te) throw new Error(te.message);
    if (!t) throw new Error("Torneo no encontrado");

    const [storeRes, gameRes, resultsRes] = await Promise.all([
      admin
        .from("stores")
        .select("id, name, city, state")
        .eq("id", t.store_id)
        .maybeSingle(),
      admin
        .from("games")
        .select("id, name, slug")
        .eq("id", t.game_id)
        .maybeSingle(),
      (async () => {
        // Try with optional columns first; fall back if columns missing.
        const full = await admin
          .from("tournament_results")
          .select(
            "player_id, rank, wins, losses, draws, points_earned, match_points, omw_percentage",
          )
          .eq("tournament_id", t.id)
          .order("rank", { ascending: true });
        if (full.error && /column .* does not exist/i.test(full.error.message)) {
          return await admin
            .from("tournament_results")
            .select("player_id, rank, wins, losses, points_earned")
            .eq("tournament_id", t.id)
            .order("rank", { ascending: true });
        }
        return full;
      })(),
    ]);
    if (storeRes.error) throw new Error(storeRes.error.message);
    if (gameRes.error) throw new Error(gameRes.error.message);
    if (resultsRes.error) throw new Error(resultsRes.error.message);

    const playerIds = Array.from(
      new Set((resultsRes.data ?? []).map((r: any) => r.player_id)),
    );
    const playersRes = playerIds.length
      ? await admin
          .from("players")
          .select("id, geek_tag, email, created_at, home_store_id")
          .in("id", playerIds)
      : { data: [] as any[], error: null };
    if ((playersRes as any).error) throw new Error((playersRes as any).error.message);

    const pMap = new Map<string, any>(
      ((playersRes as any).data ?? []).map((p: any) => [p.id, p]),
    );

    // is_new_player: player created at or after tournament upload.
    const tCreated = new Date(t.created_at ?? new Date().toISOString()).getTime();
    const results = (resultsRes.data ?? []).map((r: any) => {
      const p = pMap.get(r.player_id);
      const pCreated = p?.created_at ? new Date(p.created_at).getTime() : 0;
      return {
        rank: r.rank,
        geek_tag: p?.geek_tag ?? "—",
        match_points: r.match_points ?? null,
        omw_percentage: r.omw_percentage ?? null,
        points_earned: r.points_earned ?? 0,
        wins: r.wins ?? 0,
        losses: r.losses ?? 0,
        draws: r.draws ?? 0,
        is_new_player: p ? Math.abs(pCreated - tCreated) < 60_000 || pCreated >= tCreated : false,
      };
    });

    // Uploaded_by: best-effort — organizer of the store.
    const { data: orgs } = await admin
      .from("players")
      .select("geek_tag, email, role")
      .eq("home_store_id", t.store_id)
      .in("role", ["organizer", "admin"])
      .limit(1);
    const uploaded_by = orgs && orgs[0]
      ? { geek_tag: orgs[0].geek_tag, email: orgs[0].email }
      : null;

    // ---------- Alerts ----------
    const alerts: Alert[] = [];

    // CRITICAL: duplicate tournament (same store+game+date) already APPROVED/PUBLISHED.
    const { data: dups } = await admin
      .from("tournaments")
      .select("id, status")
      .eq("store_id", t.store_id)
      .eq("game_id", t.game_id)
      .eq("tournament_date", t.tournament_date)
      .neq("id", t.id)
      .in("status", ["APPROVED", "PUBLISHED"]);
    for (const d of dups ?? []) {
      alerts.push({
        level: "CRITICAL",
        message: `Ya existe un torneo ${d.status} de ${gameRes.data?.name ?? ""} en ${storeRes.data?.name ?? ""} el ${t.tournament_date}`,
        link: { to: `/admin/tournaments/${d.id}`, label: "Ver torneo existente" },
      });
    }

    // CRITICAL: same player appears in another tournament for the same game on the same day.
    if (playerIds.length > 0) {
      const { data: sameDayT } = await admin
        .from("tournaments")
        .select("id")
        .eq("game_id", t.game_id)
        .eq("tournament_date", t.tournament_date)
        .neq("id", t.id);
      const sameDayIds = (sameDayT ?? []).map((x) => x.id);
      if (sameDayIds.length > 0) {
        const { data: clash } = await admin
          .from("tournament_results")
          .select("player_id, tournament_id")
          .in("tournament_id", sameDayIds)
          .in("player_id", playerIds);
        const clashedPlayerIds = Array.from(
          new Set((clash ?? []).map((c) => c.player_id)),
        );
        for (const pid of clashedPlayerIds) {
          const tag = pMap.get(pid)?.geek_tag ?? pid;
          alerts.push({
            level: "CRITICAL",
            message: `El jugador ${tag} aparece en otro torneo de ${gameRes.data?.name ?? ""} el mismo día ${t.tournament_date}`,
            link: null,
          });
        }
      }
    }

    // WARNING: number of new players.
    const newCount = results.filter((r) => r.is_new_player).length;
    if (newCount > 0) {
      alerts.push({
        level: "WARNING",
        message: `${newCount} jugadores nuevos serán registrados automáticamente al aprobar`,
        link: null,
      });
    }

    // WARNING: uploaded > 3 days after tournament date.
    if (t.created_at && t.tournament_date) {
      const dt = new Date(t.tournament_date + "T00:00:00").getTime();
      const cr = new Date(t.created_at).getTime();
      const days = Math.floor((cr - dt) / 86_400_000);
      if (days > 3) {
        alerts.push({
          level: "WARNING",
          message: `Este torneo fue subido ${days} días después de la fecha del torneo`,
          link: null,
        });
      }
    }

    // WARNING: match_points not monotonically decreasing with rank.
    const haveMp = results.some((r) => typeof r.match_points === "number");
    if (haveMp) {
      const sorted = [...results].sort((a, b) => a.rank - b.rank);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1].match_points ?? -Infinity;
        const cur = sorted[i].match_points ?? -Infinity;
        if (cur > prev) {
          alerts.push({
            level: "WARNING",
            message: `El participante #${sorted[i].rank} tiene ${cur} match points pero está en posición ${sorted[i].rank}`,
            link: null,
          });
          break;
        }
      }
    }

    return {
      tournament: {
        id: t.id,
        status: t.status,
        tournament_date: t.tournament_date,
        qualifying_month: t.qualifying_month,
        qualifying_semester: t.qualifying_semester,
        qualifying_year: t.qualifying_year,
        approved_at: t.approved_at,
        undo_deadline: t.undo_deadline,
        published_at: t.published_at,
        created_at: t.created_at,
        rejection_reason: (t as any).rejection_reason ?? null,
      },
      store: storeRes.data ?? { id: t.store_id, name: "—", city: null, state: null },
      game: gameRes.data ?? { id: t.game_id, name: "—", slug: "" },
      uploaded_by,
      results,
      alerts,
    };
  });

export const rejectTournamentWithReason = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { tournament_id: string; reason: string }) =>
    z.object({
      tournament_id: z.string().uuid(),
      reason: z.string().min(20).max(2000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const update: Record<string, unknown> = {
      status: "DRAFT",
      approved_at: null,
      undo_deadline: null,
      rejection_reason: data.reason,
    };
    let { error } = await admin
      .from("tournaments")
      .update(update)
      .eq("id", data.tournament_id);
    if (error && /column .*rejection_reason.* does not exist/i.test(error.message)) {
      // Column missing — fall back to status reset only.
      delete update.rejection_reason;
      const retry = await admin
        .from("tournaments")
        .update(update)
        .eq("id", data.tournament_id);
      error = retry.error;
    }
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const approveTournamentForReview = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { tournament_id: string }) =>
    z.object({ tournament_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const now = new Date();
    const deadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const { error } = await admin
      .from("tournaments")
      .update({
        status: "APPROVED",
        approved_at: now.toISOString(),
        undo_deadline: deadline.toISOString(),
        rejection_reason: null,
      })
      .eq("id", data.tournament_id);
    if (error) {
      if (/column .*rejection_reason.* does not exist/i.test(error.message)) {
        const retry = await admin
          .from("tournaments")
          .update({
            status: "APPROVED",
            approved_at: now.toISOString(),
            undo_deadline: deadline.toISOString(),
          })
          .eq("id", data.tournament_id);
        if (retry.error) throw new Error(retry.error.message);
      } else {
        throw new Error(error.message);
      }
    }
    return { ok: true };
  });

export const undoApproveTournament = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { tournament_id: string }) =>
    z.object({ tournament_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const { data: t, error: te } = await admin
      .from("tournaments")
      .select("status, undo_deadline")
      .eq("id", data.tournament_id)
      .maybeSingle();
    if (te) throw new Error(te.message);
    if (!t) throw new Error("Torneo no encontrado");
    if (t.status !== "APPROVED") {
      throw new Error("Solo se puede deshacer un torneo aprobado");
    }
    if (t.undo_deadline && new Date(t.undo_deadline).getTime() < Date.now()) {
      throw new Error("La ventana de corrección expiró");
    }
    const { error } = await admin
      .from("tournaments")
      .update({ status: "DRAFT", approved_at: null, undo_deadline: null })
      .eq("id", data.tournament_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Store edit & organizer assignment ----------
export const updateStore = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator(
    (d: {
      store_id: string;
      name: string;
      slug: string;
      city?: string;
      state?: string;
      country?: string;
    }) =>
      z
        .object({
          store_id: z.string().uuid(),
          name: z.string().min(1).max(120),
          slug: z.string().min(1).max(80),
          city: z.string().max(120).optional(),
          state: z.string().max(120).optional(),
          country: z.string().min(2).max(2).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const slug = slugify(data.slug);
    if (!slug) throw new Error("Slug inválido");
    const { error } = await admin
      .from("stores")
      .update({
        name: data.name,
        slug,
        city: data.city || null,
        state: data.state || null,
        country: (data.country || "MX").toUpperCase(),
      })
      .eq("id", data.store_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignOrganizerToStore = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { store_id: string; player_id: string }) =>
    z
      .object({
        store_id: z.string().uuid(),
        player_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    // Clear any other organizers that currently point to this store
    const { error: ce } = await admin
      .from("players")
      .update({ home_store_id: null })
      .eq("home_store_id", data.store_id)
      .neq("id", data.player_id);
    if (ce) throw new Error(ce.message);

    const { error } = await admin
      .from("players")
      .update({ home_store_id: data.store_id })
      .eq("id", data.player_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

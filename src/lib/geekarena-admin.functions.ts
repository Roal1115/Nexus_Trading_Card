import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getGeekarenaAdmin } from "./geekarena-admin.server";
import { requireGeekarenaAdmin, requireGeekarenaUser } from "./geekarena-auth.middleware";

// ---------- Audit log helper ----------
export async function logAction(
  admin: ReturnType<typeof getGeekarenaAdmin>,
  player: { id: string; role: string; geek_tag: string },
  action: string,
  target_type: string,
  target_id: string | null,
  target_label: string,
  metadata?: Record<string, unknown>,
) {
  try {
    await admin.from("admin_audit_log").insert({
      actor_id: player.id,
      actor_role: player.role,
      actor_tag: player.geek_tag,
      action,
      target_type,
      target_id: target_id ?? undefined,
      target_label,
      metadata: metadata ?? null,
    });
  } catch (e) {
    console.error("audit log error:", e);
  }
}

// ---------- Active season helper ----------
export async function getActiveSeason(admin: ReturnType<typeof getGeekarenaAdmin>) {
  const { data } = await admin
    .from("seasons")
    .select("id, name, slug, start_date, end_date, status")
    .eq("is_active", true)
    .maybeSingle();
  return (data ?? null) as {
    id: string;
    name: string;
    slug: string;
    start_date: string;
    end_date: string;
    status: string;
  } | null;
}

export const fetchActiveSeason = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaUser])
  .handler(async ({ context }) => {
    return getActiveSeason(context.admin);
  });

export function tfMonth(month: number, year: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// Returns ISO week key "YYYY-WNN" for a given date string "YYYY-MM-DD"
// Week starts on Monday
function getWeekKey(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00Z");
  const day = date.getUTCDay(); // 0=Sun, 1=Mon ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diff);
  const year = monday.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const weekNum = Math.ceil(((monday.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}

// Recompute leaderboard snapshots for a given game+timeframe based on
// PUBLISHED tournaments in that period.
export async function recomputeSnapshot(
  admin: ReturnType<typeof getGeekarenaAdmin>,
  game_id: string,
  store_id: string,
  timeframe_type: "MONTHLY" | "SEMESTRAL",
  timeframe_value: string,
  filter: { year?: number; month?: number; season_id?: string },
  season_id?: string,
) {
  let q = admin
    .from("tournaments")
    .select("id, store_id, tournament_date, qualifying_year, qualifying_month")
    .eq("status", "PUBLISHED")
    .eq("game_id", game_id)
    .eq("store_id", store_id);
  if (filter.year != null) q = q.eq("qualifying_year", filter.year);
  if (filter.month != null) q = q.eq("qualifying_month", filter.month);
  if (filter.season_id != null) q = q.eq("season_id", filter.season_id);

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
  const tournamentDateMap = new Map<string, string>((tournaments ?? []).map((t) => [t.id, t.tournament_date]));

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
      a.played += weekResults.length;

      const top2 = weekResults.sort((x, y) => (y.points_earned ?? 0) - (x.points_earned ?? 0)).slice(0, 2);

      for (const r of top2) {
        a.total_points += r.points_earned ?? 0;
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
    season_id: season_id ?? null,
    total_points: r.total_points,
    tournaments_played: r.played,
    tournaments_won: r.won,
    omw_percentage: r.omw_count > 0 ? Math.round((r.omw_sum / r.omw_count) * 100) / 100 : 0,
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
    z
      .object({
        statuses: z.array(z.string()).min(1).max(6),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    let q = admin
      .from("tournaments")
      .select(
        "id, store_id, game_id, tournament_date, qualifying_month, qualifying_semester, qualifying_year, status, csv_url, approved_at, published_at, created_at, rejection_reason",
      )
      .in("status", data.statuses)
      .order("tournament_date", { ascending: false });
    // Excluir torneos rechazados de la cola de pendientes (DRAFT con rejection_reason).
    if (data.statuses.includes("DRAFT")) q = q.is("rejection_reason", null);
    const { data: rows, error } = await q;
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
      (sts.data ?? []).map((s) => [s.id, { name: s.name, city: s.city, state: s.state }]),
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
    z
      .object({
        tournament_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const now = new Date();
    const undoDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const { error } = await admin
      .from("tournaments")
      .update({
        status: "APPROVED",
        approved_at: now.toISOString(),
        undo_deadline: undoDeadline.toISOString(),
        approved_by: player.id,
      })
      .eq("id", data.tournament_id);
    if (error) throw new Error(error.message);

    const { data: t } = await admin
      .from("tournaments")
      .select("tournament_date, store_id, game_id, stores(name), games(name)")
      .eq("id", data.tournament_id)
      .maybeSingle();
    const game = (t as any)?.games;
    const store = (t as any)?.stores;
    await logAction(
      admin,
      player,
      "TOURNAMENT_APPROVED",
      "tournament",
      data.tournament_id,
      `${game?.name ?? "TCG"} — ${store?.name ?? "Tienda"} — ${t?.tournament_date ?? ""}`,
      { store_id: t?.store_id, game_id: t?.game_id },
    );
    return { ok: true };
  });

export const rejectTournament = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { tournament_id: string }) =>
    z
      .object({
        tournament_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: t } = await admin
      .from("tournaments")
      .select("tournament_date, stores(name), games(name)")
      .eq("id", data.tournament_id)
      .maybeSingle();
    const { error } = await admin
      .from("tournaments")
      .update({
        status: "DRAFT",
        approved_at: null,
        undo_deadline: null,
      })
      .eq("id", data.tournament_id);
    if (error) throw new Error(error.message);
    const game = (t as any)?.games;
    const store = (t as any)?.stores;
    await logAction(
      admin,
      player,
      "TOURNAMENT_REJECTED",
      "tournament",
      data.tournament_id,
      `${game?.name ?? "TCG"} — ${store?.name ?? "Tienda"} — ${t?.tournament_date ?? ""}`,
      {},
    );
    return { ok: true };
  });

export const publishTournaments = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { tournament_ids: string[] }) =>
    z
      .object({
        tournament_ids: z.array(z.string().uuid()).min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    const season = await getActiveSeason(admin);
    if (!season) {
      throw new Error("No hay una temporada activa. Crea una temporada antes de publicar torneos.");
    }
    const seasonStart = season.start_date;
    const seasonEnd = season.end_date;

    const { data: tournaments, error: te } = await admin
      .from("tournaments")
      .select("id, store_id, game_id, tournament_date, qualifying_year, qualifying_month, status")
      .in("id", data.tournament_ids);
    if (te) throw new Error(te.message);

    const approved = (tournaments ?? []).filter((t) => t.status === "APPROVED");
    const publishable = approved.filter((t) => {
      const d = t.tournament_date;
      return d >= seasonStart && d <= seasonEnd;
    });
    const outOfSeason = approved.filter((t) => !publishable.includes(t));
    if (outOfSeason.length > 0) {
      throw new Error(
        `${outOfSeason.length} torneo(s) tienen fecha fuera del rango de la temporada activa (${seasonStart} — ${seasonEnd}).`,
      );
    }
    if (publishable.length === 0) {
      return { published: 0 };
    }

    const nowIso = new Date().toISOString();
    const { error: ue } = await admin
      .from("tournaments")
      .update({
        status: "PUBLISHED",
        published_at: nowIso,
        approved_at: nowIso,
        season_id: season.id,
      })
      .in(
        "id",
        publishable.map((t) => t.id),
      );
    if (ue) throw new Error(ue.message);

    const slices = new Set<string>();
    for (const t of publishable) {
      const monthKey = tfMonth(t.qualifying_month, t.qualifying_year);
      slices.add(`${t.game_id}|${t.store_id}|MONTHLY|${monthKey}|y=${t.qualifying_year}|m=${t.qualifying_month}`);
      slices.add(`${t.game_id}|${t.store_id}|SEMESTRAL|${season.slug}|season_id=${season.id}`);
    }

    for (const key of slices) {
      const parts = key.split("|");
      const game_id = parts[0];
      const store_id = parts[1];
      const type = parts[2] as "MONTHLY" | "SEMESTRAL";
      const value = parts[3];
      const filter: { year?: number; month?: number; season_id?: string } = {};
      for (const p of parts.slice(4)) {
        const [k, v] = p.split("=");
        if (k === "y") filter.year = Number(v);
        if (k === "m") filter.month = Number(v);
        if (k === "season_id") filter.season_id = v;
      }
      await recomputeSnapshot(
        admin,
        game_id,
        store_id,
        type,
        value,
        filter,
        type === "SEMESTRAL" ? season.id : undefined,
      );
    }

    for (const t of publishable) {
      await logAction(
        admin,
        player,
        "TOURNAMENT_PUBLISHED",
        "tournament",
        t.id,
        `${t.game_id} — ${t.store_id} — ${t.tournament_date}`,
        { season_id: season.id },
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
        .select(
          "id, slug, name, city, state, country, is_active, address, phone, google_maps_url, description, opening_hours, instagram, website, twitter, twitch, created_at",
        )
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
  .inputValidator(
    (d: {
      name: string;
      city?: string;
      state?: string;
      slug?: string;
      address?: string;
      phone?: string;
      google_maps_url?: string;
      description?: string;
      opening_hours?: string;
      instagram?: string;
      website?: string;
      twitter?: string;
      twitch?: string;
    }) =>
      z
        .object({
          name: z.string().min(1).max(120),
          city: z.string().max(120).optional(),
          state: z.string().max(120).optional(),
          slug: z.string().max(80).optional(),
          address: z.string().max(300).optional(),
          phone: z.string().max(20).optional(),
          google_maps_url: z.string().url().optional().or(z.literal("")),
          description: z.string().max(500).optional(),
          opening_hours: z.string().max(200).optional(),
          instagram: z.string().max(100).optional(),
          website: z.string().max(200).optional(),
          twitter: z.string().max(100).optional(),
          twitch: z.string().max(100).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const slug = data.slug && data.slug.trim() ? slugify(data.slug) : slugify(data.name);
    if (!slug) throw new Error("Nombre inválido para generar slug");
    const { data: newStore, error } = await admin
      .from("stores")
      .insert({
        slug,
        name: data.name,
        city: data.city || null,
        state: data.state || null,
        country: "MX",
        is_active: true,
        address: data.address || null,
        phone: data.phone || null,
        google_maps_url: data.google_maps_url || null,
        description: data.description || null,
        opening_hours: data.opening_hours || null,
        instagram: data.instagram || null,
        website: data.website || null,
        twitter: data.twitter || null,
        twitch: data.twitch || null,
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    await logAction(admin, player, "STORE_CREATED", "store", newStore?.id ?? null, data.name, { city: data.city });
    return { ok: true };
  });

export const setStoreActive = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { store_id: string; is_active: boolean }) =>
    z
      .object({
        store_id: z.string().uuid(),
        is_active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const { error } = await admin.from("stores").update({ is_active: data.is_active }).eq("id", data.store_id);
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
      role?: "all" | "player" | "organizer" | "tcg_manager" | "admin";
      active?: "all" | "true" | "false";
      store_id?: string | null;
      sort?: "recent" | "geek_tag" | "points";
      page?: number;
      include_last_sign_in?: boolean;
    }) =>
      z
        .object({
          search: z.string().max(120).optional(),
          role: z.enum(["all", "player", "organizer", "tcg_manager", "admin"]).optional(),
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
        "id, geek_tag, display_name, email, role, home_store_id, is_active, created_at, manager_games(game_id, games(name))",
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
    const { error } = await admin.from("players").update({ is_active: data.is_active }).eq("id", data.player_id);
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
    const baseCols = "id, geek_tag, display_name, email, avatar_url, role, home_store_id, is_active, created_at";
    const extraCols = ", gender, birth_date, is_profile_public";

    let player: any = null;
    {
      const r = await admin
        .from("players")
        .select(baseCols + extraCols)
        .eq("id", data.player_id)
        .maybeSingle();
      if (r.error && /column .* does not exist/i.test(r.error.message)) {
        const r2 = await admin.from("players").select(baseCols).eq("id", data.player_id).maybeSingle();
        if (r2.error) throw new Error(r2.error.message);
        player = r2.data;
      } else if (r.error) {
        throw new Error(r.error.message);
      } else {
        player = r.data;
      }
    }
    if (!player) throw new Error("Jugador no encontrado");

    const [storeRes, resultsRes, snapsRes, tcgIdsRes] = await Promise.all([
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
      admin.from("player_tcg_ids").select("game_id, tcg_user_id, games(name)").eq("player_id", data.player_id),
    ]);

    const tIds = Array.from(new Set((resultsRes.data ?? []).map((r) => r.tournament_id)));
    const { data: tournaments } = tIds.length
      ? await admin.from("tournaments").select("id, tournament_date, game_id, store_id").in("id", tIds)
      : { data: [] as any[] };

    const totalPoints = (resultsRes.data ?? []).reduce((s, r) => s + (r.points_earned ?? 0), 0);
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
      tcg_ids: ((tcgIdsRes.data ?? []) as any[]).map((r) => ({
        game_id: r.game_id as string,
        tcg_user_id: r.tcg_user_id as string,
        games: Array.isArray(r.games) ? (r.games[0] ?? null) : (r.games ?? null),
      })) as Array<{
        game_id: string;
        tcg_user_id: string;
        games: { name: string } | null;
      }>,
    };
  });

function normalizeTcgId(id: string): string {
  const stripped = id.replace(/^0+/, "");
  return stripped === "" ? "0" : stripped;
}

export const updatePlayerDetail = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator(
    (d: {
      player_id: string;
      display_name?: string | null;
      gender?: string | null;
      birth_date?: string | null;
      is_profile_public?: boolean;
      tcg_ids?: Array<{ game_id: string; tcg_user_id: string }>;
    }) =>
      z
        .object({
          player_id: z.string().uuid(),
          display_name: z.string().max(120).nullable().optional(),
          gender: z.string().max(40).nullable().optional(),
          birth_date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .nullable()
            .optional(),
          is_profile_public: z.boolean().optional(),
          tcg_ids: z
            .array(
              z.object({
                game_id: z.string().uuid(),
                tcg_user_id: z.string().min(1).max(120),
              }),
            )
            .optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;

    const update: Record<string, unknown> = {};
    if (data.display_name !== undefined) update.display_name = data.display_name || null;
    if (data.gender !== undefined) update.gender = data.gender || null;
    if (data.birth_date !== undefined) update.birth_date = data.birth_date || null;
    if (data.is_profile_public !== undefined) update.is_profile_public = data.is_profile_public;

    if (Object.keys(update).length > 0) {
      const { error } = await admin.from("players").update(update).eq("id", data.player_id);
      if (error && !/column .* does not exist/i.test(error.message)) {
        throw new Error(error.message);
      }
      if (error) {
        // Retry only with always-present columns
        const safe: Record<string, unknown> = {};
        if (update.display_name !== undefined) safe.display_name = update.display_name;
        if (Object.keys(safe).length > 0) {
          const r2 = await admin.from("players").update(safe).eq("id", data.player_id);
          if (r2.error) throw new Error(r2.error.message);
        }
      }
    }

    if (data.tcg_ids) {
      const rows = data.tcg_ids.map((t) => ({
        player_id: data.player_id,
        game_id: t.game_id,
        tcg_user_id: t.tcg_user_id.trim(),
        tcg_user_id_normalized: normalizeTcgId(t.tcg_user_id.trim()),
      }));
      if (rows.length > 0) {
        const { error } = await admin.from("player_tcg_ids").upsert(rows, { onConflict: "player_id,game_id" });
        if (error) throw new Error(error.message);
      }
    }

    const { data: target } = await admin.from("players").select("geek_tag").eq("id", data.player_id).maybeSingle();

    await logAction(
      admin,
      player,
      "PLAYER_DETAIL_UPDATED",
      "player",
      data.player_id,
      target?.geek_tag ?? data.player_id,
      { fields: Object.keys(update), tcg_ids_count: data.tcg_ids?.length ?? 0 },
    );

    return { ok: true };
  });

export const setPlayerRole = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator(
    (d: { player_id: string; role: "player" | "organizer" | "tcg_manager" | "admin"; home_store_id?: string | null }) =>
      z
        .object({
          player_id: z.string().uuid(),
          role: z.enum(["player", "organizer", "tcg_manager", "admin"]),
          home_store_id: z.string().uuid().optional().nullable(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: targetPlayer } = await admin
      .from("players")
      .select("geek_tag, role")
      .eq("id", data.player_id)
      .maybeSingle();
    const update: Record<string, unknown> = { role: data.role };
    if (data.home_store_id !== undefined) update.home_store_id = data.home_store_id;
    const { error } = await admin.from("players").update(update).eq("id", data.player_id);
    if (error) throw new Error(error.message);

    // Limpiar TCGs asignados si el rol ya no es tcg_manager
    if (data.role !== "tcg_manager") {
      await admin.from("manager_games").delete().eq("player_id", data.player_id);
    }

    await logAction(admin, player, "ROLE_CHANGED", "player", data.player_id, targetPlayer?.geek_tag ?? data.player_id, {
      old_role: targetPlayer?.role,
      new_role: data.role,
    });
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
  .inputValidator((d: { tournament_id: string }) => z.object({ tournament_id: z.string().uuid() }).parse(d))
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
      admin.from("stores").select("id, name, city, state").eq("id", t.store_id).maybeSingle(),
      admin.from("games").select("id, name, slug").eq("id", t.game_id).maybeSingle(),
      (async () => {
        // Try with optional columns first; fall back if columns missing.
        const full = await admin
          .from("tournament_results")
          .select("player_id, rank, wins, losses, draws, points_earned, match_points, omw_percentage")
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

    const playerIds = Array.from(new Set((resultsRes.data ?? []).map((r: any) => r.player_id)));
    const playersRes = playerIds.length
      ? await admin.from("players").select("id, geek_tag, email, created_at, home_store_id").in("id", playerIds)
      : { data: [] as any[], error: null };
    if ((playersRes as any).error) throw new Error((playersRes as any).error.message);

    const pMap = new Map<string, any>(((playersRes as any).data ?? []).map((p: any) => [p.id, p]));

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
    const uploaded_by = orgs && orgs[0] ? { geek_tag: orgs[0].geek_tag, email: orgs[0].email } : null;

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
        const clashedPlayerIds = Array.from(new Set((clash ?? []).map((c) => c.player_id)));
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
    z
      .object({
        tournament_id: z.string().uuid(),
        reason: z.string().min(20).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: tBefore } = await admin
      .from("tournaments")
      .select("tournament_date, stores(name), games(name)")
      .eq("id", data.tournament_id)
      .maybeSingle();
    const update: Record<string, unknown> = {
      status: "DRAFT",
      approved_at: null,
      undo_deadline: null,
      rejection_reason: data.reason,
    };
    let { error } = await admin.from("tournaments").update(update).eq("id", data.tournament_id);
    if (error && /column .*rejection_reason.* does not exist/i.test(error.message)) {
      // Column missing — fall back to status reset only.
      delete update.rejection_reason;
      const retry = await admin.from("tournaments").update(update).eq("id", data.tournament_id);
      error = retry.error;
    }
    if (error) throw new Error(error.message);
    const game = (tBefore as any)?.games;
    const store = (tBefore as any)?.stores;
    await logAction(
      admin,
      player,
      "TOURNAMENT_REJECTED",
      "tournament",
      data.tournament_id,
      `${game?.name ?? "TCG"} — ${store?.name ?? "Tienda"} — ${tBefore?.tournament_date ?? ""}`,
      { reason: data.reason },
    );
    return { ok: true };
  });

export const approveTournamentForReview = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { tournament_id: string }) => z.object({ tournament_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const now = new Date();
    const deadline = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const { error } = await admin
      .from("tournaments")
      .update({
        status: "APPROVED",
        approved_at: now.toISOString(),
        undo_deadline: deadline.toISOString(),
        rejection_reason: null,
        approved_by: player.id,
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
            approved_by: player.id,
          })
          .eq("id", data.tournament_id);
        if (retry.error) throw new Error(retry.error.message);
      } else {
        throw new Error(error.message);
      }
    }
    const { data: tAfter } = await admin
      .from("tournaments")
      .select("tournament_date, store_id, game_id, stores(name), games(name)")
      .eq("id", data.tournament_id)
      .maybeSingle();
    const game = (tAfter as any)?.games;
    const store = (tAfter as any)?.stores;
    await logAction(
      admin,
      player,
      "TOURNAMENT_APPROVED",
      "tournament",
      data.tournament_id,
      `${game?.name ?? "TCG"} — ${store?.name ?? "Tienda"} — ${tAfter?.tournament_date ?? ""}`,
      { store_id: tAfter?.store_id, game_id: tAfter?.game_id },
    );
    return { ok: true };
  });

export const undoApproveTournament = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { tournament_id: string }) => z.object({ tournament_id: z.string().uuid() }).parse(d))
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
      city?: string;
      state?: string;
      country?: string;
      address?: string;
      phone?: string;
      google_maps_url?: string;
      description?: string;
      opening_hours?: string;
      instagram?: string;
      website?: string;
      twitter?: string;
      twitch?: string;
    }) =>
      z
        .object({
          store_id: z.string().uuid(),
          name: z.string().min(1).max(120),
          city: z.string().max(120).optional(),
          state: z.string().max(120).optional(),
          country: z.string().min(2).max(2).optional(),
          address: z.string().max(300).optional(),
          phone: z.string().max(20).optional(),
          google_maps_url: z.string().url().optional().or(z.literal("")),
          description: z.string().max(500).optional(),
          opening_hours: z.string().max(200).optional(),
          instagram: z.string().max(100).optional(),
          website: z.string().max(200).optional(),
          twitter: z.string().max(100).optional(),
          twitch: z.string().max(100).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { error } = await admin
      .from("stores")
      .update({
        name: data.name,
        city: data.city || null,
        state: data.state || null,
        country: (data.country || "MX").toUpperCase(),
        address: data.address || null,
        phone: data.phone || null,
        google_maps_url: data.google_maps_url || null,
        description: data.description || null,
        opening_hours: data.opening_hours || null,
        instagram: data.instagram || null,
        website: data.website || null,
        twitter: data.twitter || null,
        twitch: data.twitch || null,
      })
      .eq("id", data.store_id);
    if (error) throw new Error(error.message);
    await logAction(admin, player, "STORE_UPDATED", "store", data.store_id, data.name, {
      changes: data as unknown as Record<string, unknown>,
    });
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
    const { admin, player } = context;
    // Clear any other organizers that currently point to this store
    const { error: ce } = await admin
      .from("players")
      .update({ home_store_id: null })
      .eq("home_store_id", data.store_id)
      .neq("id", data.player_id);
    if (ce) throw new Error(ce.message);

    const { error } = await admin.from("players").update({ home_store_id: data.store_id }).eq("id", data.player_id);
    if (error) throw new Error(error.message);

    const { data: store } = await admin.from("stores").select("name").eq("id", data.store_id).maybeSingle();
    const { data: targetPlayer } = await admin
      .from("players")
      .select("geek_tag")
      .eq("id", data.player_id)
      .maybeSingle();
    await logAction(admin, player, "ORGANIZER_ASSIGNED", "store", data.store_id, store?.name ?? data.store_id, {
      player_id: data.player_id,
      geek_tag: targetPlayer?.geek_tag,
    });
    return { ok: true };
  });

// ---------- Seasons ----------
export const listSeasons = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .handler(async ({ context }) => {
    const { data, error } = await context.admin
      .from("seasons")
      .select("id, name, slug, start_date, end_date, is_active, status, created_at")
      .order("start_date", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createSeason = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { name: string; slug: string; start_date: string; end_date: string }) =>
    z
      .object({
        name: z.string().min(3).max(120),
        slug: z
          .string()
          .min(3)
          .max(80)
          .regex(/^[a-z0-9-]+$/, "Slug inválido"),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    if (data.end_date < data.start_date) {
      throw new Error("La fecha de fin debe ser posterior a la de inicio.");
    }
    const { data: newSeason, error } = await admin
      .from("seasons")
      .insert({
        name: data.name,
        slug: data.slug,
        start_date: data.start_date,
        end_date: data.end_date,
        is_active: false,
        status: "UPCOMING",
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    await logAction(admin, player, "SEASON_CREATED", "season", newSeason?.id ?? null, data.name, {
      start_date: data.start_date,
      end_date: data.end_date,
    });
    return { ok: true };
  });

export const activateSeason = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { season_id: string }) => z.object({ season_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { error: de } = await admin.from("seasons").update({ is_active: false }).neq("id", data.season_id);
    if (de) throw new Error(de.message);
    const { error } = await admin
      .from("seasons")
      .update({ is_active: true, status: "ACTIVE" })
      .eq("id", data.season_id);
    if (error) throw new Error(error.message);
    const { data: season } = await admin.from("seasons").select("name").eq("id", data.season_id).maybeSingle();
    await logAction(admin, player, "SEASON_ACTIVATED", "season", data.season_id, season?.name ?? data.season_id);
    return { ok: true };
  });

export const closeSeason = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { season_id: string }) => z.object({ season_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { error } = await admin
      .from("seasons")
      .update({ is_active: false, status: "CLOSED" })
      .eq("id", data.season_id);
    if (error) throw new Error(error.message);
    const { data: season } = await admin.from("seasons").select("name").eq("id", data.season_id).maybeSingle();
    await logAction(admin, player, "SEASON_CLOSED", "season", data.season_id, season?.name ?? data.season_id);
    return { ok: true };
  });

// ---------- Audit log ----------
export const listAuditLog = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator(
    (d: {
      action?: string;
      actor_role?: string;
      target_type?: string;
      date_from?: string;
      date_to?: string;
      search?: string;
      page?: number;
    }) =>
      z
        .object({
          action: z.string().optional(),
          actor_role: z.string().optional(),
          target_type: z.string().optional(),
          date_from: z.string().optional(),
          date_to: z.string().optional(),
          search: z.string().max(100).optional(),
          page: z.number().min(1).default(1),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const PAGE_SIZE = 25;
    const page = data.page ?? 1;
    const offset = (page - 1) * PAGE_SIZE;

    let q = admin
      .from("admin_audit_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (data.action) q = q.eq("action", data.action);
    if (data.actor_role) q = q.eq("actor_role", data.actor_role);
    if (data.target_type) q = q.eq("target_type", data.target_type);
    if (data.date_from) q = q.gte("created_at", data.date_from);
    if (data.date_to) q = q.lte("created_at", data.date_to + "T23:59:59Z");
    if (data.search) {
      const s = data.search.replace(/[%,]/g, "");
      const pat = `%${s}%`;
      q = q.or(`actor_tag.ilike.${pat},target_label.ilike.${pat},action.ilike.${pat},target_type.ilike.${pat}`);
    }

    const { data: logs, count, error } = await q;
    if (error) throw new Error(error.message);

    return {
      logs: (logs ?? []) as AuditLogRow[],
      total: count ?? 0,
      page,
      page_size: PAGE_SIZE,
    };
  });

export type AuditLogRow = {
  id: string;
  actor_id: string;
  actor_role: string;
  actor_tag: string;
  action: string;
  target_type: string;
  target_id: string | null;
  target_label: string;
  metadata: { [key: string]: string | number | boolean | null | undefined } | null;
  created_at: string;
};

// ---------- Badge counts ----------
export const getAdminBadgeCounts = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { activity_last_seen?: string }) => z.object({ activity_last_seen: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const nowIso = new Date().toISOString();

    const pendingP = admin
      .from("tournaments")
      .select("*", { count: "exact", head: true })
      .eq("status", "DRAFT")
      .is("rejection_reason", null);

    const readyP = admin
      .from("tournaments")
      .select("*", { count: "exact", head: true })
      .eq("status", "APPROVED")
      .lt("undo_deadline", nowIso);

    const approvedActiveP = admin
      .from("tournaments")
      .select("*", { count: "exact", head: true })
      .eq("status", "APPROVED");

    let activityQ = admin.from("admin_audit_log").select("*", { count: "exact", head: true });
    if (data.activity_last_seen) {
      activityQ = activityQ.gt("created_at", data.activity_last_seen);
    }

    const [pending, readyToPublish, approvedActive, activityCount] = await Promise.all([
      pendingP,
      readyP,
      approvedActiveP,
      activityQ,
    ]);

    return {
      pending: pending.count ?? 0,
      readyToPublish: readyToPublish.count ?? 0,
      approvedActive: approvedActive.count ?? 0,
      activity: activityCount.count ?? 0,
    };
  });

// ---------- Historial Global de Torneos ----------
export const getAdminTournamentHistory = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator(
    (d: {
      status?: string;
      game_id?: string;
      store_id?: string;
      date_from?: string;
      date_to?: string;
      season_id?: string;
      page?: number;
    }) =>
      z
        .object({
          status: z.string().optional(),
          game_id: z.string().optional(),
          store_id: z.string().optional(),
          date_from: z.string().optional(),
          date_to: z.string().optional(),
          season_id: z.string().optional(),
          page: z.number().min(1).default(1),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const PAGE_SIZE = 25;
    const page = data.page ?? 1;
    const offset = (page - 1) * PAGE_SIZE;

    const baseCols = "id, tournament_date, status, csv_url, approved_at, published_at, created_at, game_id, store_id";
    const extraCols = ", rejection_reason, approved_by, season_id";

    const build = (cols: string) => {
      let q = admin
        .from("tournaments")
        .select(cols, { count: "exact" })
        .order("tournament_date", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (data.status) q = q.eq("status", data.status);
      if (data.game_id) q = q.eq("game_id", data.game_id);
      if (data.store_id) q = q.eq("store_id", data.store_id);
      if (data.date_from) q = q.gte("tournament_date", data.date_from);
      if (data.date_to) q = q.lte("tournament_date", data.date_to);
      if (data.season_id) q = q.eq("season_id", data.season_id);
      return q;
    };

    let res = await build(baseCols + extraCols);
    if (res.error && /column .* does not exist/i.test(res.error.message)) {
      res = await build(baseCols);
    }
    if (res.error) throw new Error(res.error.message);

    const rows = (res.data ?? []) as any[];
    const count = res.count;
    const gameIds = Array.from(new Set(rows.map((r) => r.game_id)));
    const storeIds = Array.from(new Set(rows.map((r) => r.store_id)));
    const approverIds = Array.from(new Set(rows.filter((r) => r.approved_by).map((r) => r.approved_by as string)));
    const tournamentIds = rows.map((r) => r.id);

    const [gmsRes, storesRes, approversRes, resultsRes, allStatsRes] = await Promise.all([
      gameIds.length
        ? admin.from("games").select("id, name").in("id", gameIds)
        : Promise.resolve({ data: [] as any[] }),
      storeIds.length
        ? admin.from("stores").select("id, name, city").in("id", storeIds)
        : Promise.resolve({ data: [] as any[] }),
      approverIds.length
        ? admin.from("players").select("id, geek_tag, role").in("id", approverIds)
        : Promise.resolve({ data: [] as any[] }),
      tournamentIds.length
        ? admin.from("tournament_results").select("tournament_id").in("tournament_id", tournamentIds)
        : Promise.resolve({ data: [] as any[] }),
      admin.from("tournaments").select("status"),
    ]);

    const gamesMap = Object.fromEntries((gmsRes.data ?? []).map((g: any) => [g.id, g.name]));
    const storesMap = Object.fromEntries((storesRes.data ?? []).map((s: any) => [s.id, s]));
    const approversMap = Object.fromEntries((approversRes.data ?? []).map((p: any) => [p.id, p]));
    const participantMap = (resultsRes.data ?? []).reduce((acc: Record<string, number>, r: any) => {
      acc[r.tournament_id] = (acc[r.tournament_id] ?? 0) + 1;
      return acc;
    }, {});
    const globalStats = (allStatsRes.data ?? []).reduce((acc: Record<string, number>, t: any) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      total: count ?? 0,
      page,
      stats: globalStats,
      tournaments: rows.map((r) => {
        const store: any = storesMap[r.store_id];
        const approver: any = r.approved_by ? approversMap[r.approved_by] : null;
        return {
          ...r,
          game_name: gamesMap[r.game_id] ?? "—",
          store_name: store?.name ?? "—",
          store_city: store?.city ?? "—",
          approved_by_tag: approver?.geek_tag ?? null,
          approved_by_role: approver?.role ?? null,
          participants: participantMap[r.id] ?? 0,
        };
      }),
    };
  });

// ---------- Filter dropdowns (admin history page) ----------
export const getAdminFilterOptions = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .handler(async ({ context }) => {
    const { admin } = context;
    const [gamesRes, storesRes, seasonsRes] = await Promise.all([
      admin.from("games").select("id, name").eq("is_active", true).order("name"),
      admin.from("stores").select("id, name, city").eq("is_active", true).order("city").order("name"),
      admin.from("seasons").select("id, name, slug, status").order("start_date", { ascending: false }),
    ]);
    return {
      games: gamesRes.data ?? [],
      stores: storesRes.data ?? [],
      seasons: seasonsRes.data ?? [],
    };
  });

// ---------- Manager TCG assignment helper ----------
export const getManagerAssignedGames = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { player_id: string }) => z.object({ player_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { admin } = context;
    const [allGames, assigned] = await Promise.all([
      admin.from("games").select("id, name, slug").eq("is_active", true).order("name"),
      admin.from("manager_games").select("game_id").eq("player_id", data.player_id),
    ]);
    const assignedIds = new Set((assigned.data ?? []).map((r: any) => r.game_id));
    return {
      all_games: (allGames.data ?? []) as Array<{ id: string; name: string; slug: string }>,
      assigned_game_ids: Array.from(assignedIds) as string[],
    };
  });

// ---------- Staff (organizer / tcg_manager) management ----------
export const listStaffMembers = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .handler(async ({ context }) => {
    const { admin } = context;

    const { data, error } = await admin
      .from("players")
      .select(
        "id, geek_tag, email, role, is_active, home_store_id, work_schedule, contact_primary, contact_backup, created_at, manager_games(game_id, games(id, name))",
      )
      .in("role", ["organizer", "tcg_manager", "admin"])
      .order("role", { ascending: true })
      .order("geek_tag", { ascending: true });

    if (error) throw new Error(error.message);

    const storeIds = Array.from(
      new Set((data ?? []).filter((p: any) => p.home_store_id).map((p: any) => p.home_store_id as string)),
    );
    const storesRes = storeIds.length
      ? await admin.from("stores").select("id, name, city").in("id", storeIds)
      : { data: [] as any[] };
    const storeMap = new Map(((storesRes.data ?? []) as any[]).map((s: any) => [s.id, s]));

    return (data ?? []).map((p: any) => ({
      id: p.id,
      geek_tag: p.geek_tag,
      email: p.email,
      role: p.role,
      is_active: p.is_active,
      home_store: p.home_store_id ? (storeMap.get(p.home_store_id) ?? null) : null,
      manager_games: p.manager_games ?? [],
      work_schedule: p.work_schedule ?? null,
      contact_primary: p.contact_primary ?? null,
      contact_backup: p.contact_backup ?? null,
      created_at: p.created_at,
    }));
  });

export const upsertStaffMember = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator(
    (d: {
      email: string;
      geek_tag: string;
      role: "tcg_manager" | "organizer";
      work_schedule?: string;
      contact_primary?: string;
      contact_backup?: string;
    }) =>
      z
        .object({
          email: z.string().email(),
          geek_tag: z.string().min(3).max(30),
          role: z.enum(["tcg_manager", "organizer"]),
          work_schedule: z.string().max(200).optional(),
          contact_primary: z.string().max(50).optional(),
          contact_backup: z.string().max(50).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player: actor } = context;

    const opFields = {
      work_schedule: data.work_schedule ?? null,
      contact_primary: data.contact_primary ?? null,
      contact_backup: data.contact_backup ?? null,
    };

    // Step 1 — check if player already exists by email
    const { data: existingByEmail } = await admin
      .from("players")
      .select("id, geek_tag, role")
      .eq("email", data.email)
      .maybeSingle();

    if (existingByEmail) {
      const updates: Record<string, unknown> = {
        role: data.role,
        ...opFields,
      };
      if (existingByEmail.geek_tag !== data.geek_tag) {
        const { data: tagTaken } = await admin
          .from("players")
          .select("id")
          .eq("geek_tag", data.geek_tag)
          .neq("id", existingByEmail.id)
          .maybeSingle();
        if (!tagTaken) updates.geek_tag = data.geek_tag;
      }
      const { error } = await admin.from("players").update(updates).eq("id", existingByEmail.id);
      if (error) throw new Error(error.message);

      if (existingByEmail.role === "tcg_manager" && data.role !== "tcg_manager") {
        await admin.from("manager_games").delete().eq("player_id", existingByEmail.id);
      }

      await logAction(admin, actor, "ROLE_CHANGED", "player", existingByEmail.id, existingByEmail.geek_tag, {
        old_role: existingByEmail.role,
        new_role: data.role,
        source: "staff_upsert",
      });

      return { player_id: existingByEmail.id as string, was_existing: true };
    }

    // Scenario A — new user: create auth account, then update player record
    const tempPassword = Math.random().toString(36).slice(2) + "Aa1!";
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { geek_tag: data.geek_tag },
    });
    if (authErr) throw new Error(authErr.message);

    // Trigger handle_new_auth_user should create the players row; fetch it
    const { data: newPlayer } = await admin
      .from("players")
      .select("id")
      .eq("auth_user_id", authUser.user.id)
      .maybeSingle();

    let playerId: string | null = newPlayer?.id ?? null;

    if (playerId) {
      await admin
        .from("players")
        .update({
          role: data.role,
          email: data.email,
          geek_tag: data.geek_tag,
          is_active: true,
          ...opFields,
        })
        .eq("id", playerId);
    }

    await logAction(admin, actor, "ROLE_CHANGED", "player", playerId, data.geek_tag, {
      new_role: data.role,
      source: "staff_created",
    });

    return { player_id: playerId, was_existing: false };
  });

export const updateStaffOperationalFields = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator(
    (d: {
      player_id: string;
      work_schedule?: string | null;
      contact_primary?: string | null;
      contact_backup?: string | null;
    }) =>
      z
        .object({
          player_id: z.string().uuid(),
          work_schedule: z.string().max(200).nullable().optional(),
          contact_primary: z.string().max(50).nullable().optional(),
          contact_backup: z.string().max(50).nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const { error } = await admin
      .from("players")
      .update({
        work_schedule: data.work_schedule ?? null,
        contact_primary: data.contact_primary ?? null,
        contact_backup: data.contact_backup ?? null,
      })
      .eq("id", data.player_id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deactivateStaffMember = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { player_id: string; action: "deactivate" | "delete" }) =>
    z
      .object({
        player_id: z.string().uuid(),
        action: z.enum(["deactivate", "delete"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player: actor } = context;
    if (data.action === "deactivate") {
      const { error } = await admin.from("players").update({ is_active: false }).eq("id", data.player_id);
      if (error) throw new Error(error.message);
      await logAction(admin, actor, "ROLE_CHANGED", "player", data.player_id, data.player_id, {
        action: "deactivated",
      });
    } else {
      const { error } = await admin
        .from("players")
        .update({ role: "player", is_active: false })
        .eq("id", data.player_id);
      if (error) throw new Error(error.message);
      await admin.from("manager_games").delete().eq("player_id", data.player_id);
      await logAction(admin, actor, "ROLE_CHANGED", "player", data.player_id, data.player_id, {
        action: "removed_from_staff",
      });
    }
    return { success: true };
  });

// ==================== Store Schedules (Admin) ====================

export const getStoreSchedules = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { store_id: string }) => z.object({ store_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const [schedulesRes, gamesRes] = await Promise.all([
      admin
        .from("store_schedules")
        .select("id, store_id, game_id, day_of_week, start_time, games(id, name)")
        .eq("store_id", data.store_id)
        .order("game_id")
        .order("day_of_week"),
      admin.from("games").select("id, name").eq("is_active", true).order("name"),
    ]);
    return {
      schedules: schedulesRes.data ?? [],
      games: gamesRes.data ?? [],
    };
  });

export const upsertStoreSchedule = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { store_id: string; game_id: string; day_of_week: number; start_time: string; id?: string }) =>
    z
      .object({
        store_id: z.string().uuid(),
        game_id: z.string().uuid(),
        day_of_week: z.number().int().min(0).max(6),
        start_time: z.string().regex(/^\d{2}:\d{2}$/),
        id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    if (data.id) {
      const { error } = await admin
        .from("store_schedules")
        .update({
          game_id: data.game_id,
          day_of_week: data.day_of_week,
          start_time: data.start_time,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin.from("store_schedules").upsert(
        {
          store_id: data.store_id,
          game_id: data.game_id,
          day_of_week: data.day_of_week,
          start_time: data.start_time,
        },
        { onConflict: "store_id,game_id,day_of_week" },
      );
      if (error) throw new Error(error.message);
    }
    return { success: true };
  });

export const deleteStoreSchedule = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { schedule_id: string }) => z.object({ schedule_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.admin.from("store_schedules").delete().eq("id", data.schedule_id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// ==================== Delete Player Account ====================

export const deletePlayerAccount = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { player_id: string; confirm_tag: string }) =>
    z
      .object({
        player_id: z.string().uuid(),
        confirm_tag: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player: actor } = context;
    const { data: target } = await admin
      .from("players")
      .select("id, geek_tag, auth_user_id, role")
      .eq("id", data.player_id)
      .maybeSingle();
    if (!target) throw new Error("Usuario no encontrado");
    if ((target as any).geek_tag !== data.confirm_tag) {
      throw new Error("El Player Tag no coincide");
    }
    if ((target as any).role === "admin") {
      throw new Error("No puedes eliminar una cuenta de admin");
    }
    const authUserId = (target as any).auth_user_id as string | null;
    if (authUserId) {
      try {
        await admin.auth.admin.deleteUser(authUserId);
      } catch (e) {
        console.error("auth deleteUser error:", e);
      }
    }
    const { error } = await admin.from("players").delete().eq("id", data.player_id);
    if (error) throw new Error(error.message);
    await logAction(admin, actor, "ACCOUNT_DELETED", "player", data.player_id, (target as any).geek_tag);
    return { success: true };
  });

// ==================== Unapprove Tournament (Admin) ====================

export const unapproveAdminTournament = createServerFn({ method: "POST" })
  .middleware([requireGeekarenaAdmin])
  .inputValidator((d: { tournament_id: string; reason: string }) =>
    z
      .object({
        tournament_id: z.string().uuid(),
        reason: z.string().min(10, "El motivo debe tener al menos 10 caracteres"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    const { data: t } = await admin
      .from("tournaments")
      .select("status, game_id, store_id, tournament_date")
      .eq("id", data.tournament_id)
      .maybeSingle();
    if (!t || (t as any).status !== "APPROVED") {
      throw new Error("Torneo no válido para des-aprobación");
    }
    const { error } = await admin
      .from("tournaments")
      .update({
        status: "DRAFT",
        approved_at: null,
        undo_deadline: null,
        approved_by: null,
        rejection_reason: data.reason,
      })
      .eq("id", data.tournament_id);
    if (error) throw new Error(error.message);
    await logAction(
      admin,
      player,
      "TOURNAMENT_REJECTED",
      "tournament",
      data.tournament_id,
      `${(t as any).game_id} — ${(t as any).store_id}`,
      { reason: data.reason, unapproved_by_role: player.role },
    );
    return { success: true };
  });

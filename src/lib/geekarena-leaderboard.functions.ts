// Public leaderboard reads. No auth middleware: data is public.
// All reads go through the admin client server-side to keep RLS simple.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getGeekarenaAdmin } from "./geekarena-admin.server";

export const getLeaderboardOptions = createServerFn({ method: "POST" }).handler(
  async () => {
    const admin = getGeekarenaAdmin();
    const [gamesRes, storesRes, monthsRes] = await Promise.all([
      admin
        .from("games")
        .select("id, slug, name")
        .eq("is_active", true)
        .order("name"),
      admin
        .from("stores")
        .select("id, name, city")
        .eq("is_active", true)
        .order("city", { ascending: true })
        .order("name", { ascending: true }),
      admin
        .from("tournaments")
        .select("qualifying_month, qualifying_year")
        .in("status", ["APPROVED", "PUBLISHED"])
        .order("qualifying_year", { ascending: false })
        .order("qualifying_month", { ascending: false }),
    ]);
    if (gamesRes.error) throw new Error(gamesRes.error.message);
    if (storesRes.error) throw new Error(storesRes.error.message);
    if (monthsRes.error) throw new Error(monthsRes.error.message);

    const monthSet = new Set<string>();
    for (const r of monthsRes.data ?? []) {
      monthSet.add(`${r.qualifying_year}-${String(r.qualifying_month).padStart(2, "0")}`);
    }
    const months = Array.from(monthSet).sort().reverse();

    return {
      games: gamesRes.data ?? [],
      stores: storesRes.data ?? [],
      months,
    };
  },
);

export const getLeaderboard = createServerFn({ method: "POST" })
  .inputValidator((d: {
    game_id?: string | null;
    city?: string | null;
    store_id?: string | null;
    month?: string | null; // "YYYY-MM"
  }) =>
    z.object({
      game_id: z.string().uuid().nullable().optional(),
      city: z.string().max(120).nullable().optional(),
      store_id: z.string().uuid().nullable().optional(),
      month: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const admin = getGeekarenaAdmin();

    // 1. Find tournaments matching filters (status approved/published)
    let tq = admin
      .from("tournaments")
      .select("id, store_id, game_id, qualifying_month, qualifying_year")
      .in("status", ["APPROVED", "PUBLISHED"]);

    if (data.game_id) tq = tq.eq("game_id", data.game_id);
    if (data.month) {
      const [y, m] = data.month.split("-");
      tq = tq.eq("qualifying_year", Number(y)).eq("qualifying_month", Number(m));
    }

    // Resolve store filter (explicit store wins over city)
    let storeIds: string[] | null = null;
    if (data.store_id) {
      storeIds = [data.store_id];
    } else if (data.city) {
      const { data: cityStores, error } = await admin
        .from("stores")
        .select("id")
        .eq("is_active", true)
        .eq("city", data.city);
      if (error) throw new Error(error.message);
      storeIds = (cityStores ?? []).map((s) => s.id);
      if (storeIds.length === 0) return { rows: [] };
    }
    if (storeIds) tq = tq.in("store_id", storeIds);

    const { data: tournaments, error: te } = await tq;
    if (te) throw new Error(te.message);
    if (!tournaments || tournaments.length === 0) return { rows: [] };

    const tIds = tournaments.map((t) => t.id);
    const tMap = new Map(tournaments.map((t) => [t.id, t]));

    // 2. Fetch results for those tournaments
    const { data: results, error: re } = await admin
      .from("tournament_results")
      .select("tournament_id, player_id, rank, wins, losses, points_earned")
      .in("tournament_id", tIds);
    if (re) throw new Error(re.message);

    // 3. Fetch players + stores for shaping
    const playerIds = Array.from(new Set((results ?? []).map((r) => r.player_id)));
    const storeIdsAll = Array.from(new Set(tournaments.map((t) => t.store_id)));
    const [playersRes, storesRes] = await Promise.all([
      playerIds.length
        ? admin.from("players").select("id, geek_tag").in("id", playerIds)
        : Promise.resolve({ data: [], error: null } as const),
      storeIdsAll.length
        ? admin.from("stores").select("id, name, city").in("id", storeIdsAll)
        : Promise.resolve({ data: [], error: null } as const),
    ]);
    if (playersRes.error) throw new Error(playersRes.error.message);
    if (storesRes.error) throw new Error(storesRes.error.message);

    const playerMap = new Map((playersRes.data ?? []).map((p) => [p.id, p]));
    const storeMap = new Map((storesRes.data ?? []).map((s) => [s.id, s]));

    // 4. Aggregate per player
    type Agg = {
      player_id: string;
      points: number;
      tournaments_won: number;
      wins: number;
      losses: number;
      cities: Set<string>;
    };
    const agg = new Map<string, Agg>();
    for (const r of results ?? []) {
      const t = tMap.get(r.tournament_id);
      if (!t) continue;
      const city = storeMap.get(t.store_id)?.city ?? null;
      let a = agg.get(r.player_id);
      if (!a) {
        a = {
          player_id: r.player_id,
          points: 0,
          tournaments_won: 0,
          wins: 0,
          losses: 0,
          cities: new Set(),
        };
        agg.set(r.player_id, a);
      }
      a.points += r.points_earned ?? 0;
      if (r.rank === 1) a.tournaments_won += 1;
      a.wins += r.wins ?? 0;
      a.losses += r.losses ?? 0;
      if (city) a.cities.add(city);
    }

    const rows = Array.from(agg.values())
      .map((a) => {
        const p = playerMap.get(a.player_id);
        return {
          player_id: a.player_id,
          geek_tag: p?.geek_tag ?? "—",
          city:
            a.cities.size === 1
              ? Array.from(a.cities)[0]
              : a.cities.size > 1
                ? "Varias"
                : "—",
          points: a.points,
          tournaments_won: a.tournaments_won,
          wins: a.wins,
          losses: a.losses,
        };
      })
      .sort((x, y) => y.points - x.points);

    return { rows };
  });

// Public leaderboard reads. No auth middleware: data is public.
// All reads go through the admin client server-side to keep RLS simple.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getGeekarenaAdmin } from "./geekarena-admin.server";

export const getLeaderboardOptions = createServerFn({ method: "POST" }).handler(async () => {
  const admin = getGeekarenaAdmin();
  const [gamesRes, storesRes, monthsRes] = await Promise.all([
    admin.from("games").select("id, slug, name").eq("is_active", true).order("name"),
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
});

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

async function getSeasonForMonth(
  admin: ReturnType<typeof getGeekarenaAdmin>,
  monthValue: string,
): Promise<{ id: string; slug: string; name: string } | null> {
  const [year, month] = monthValue.split("-").map(Number);
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const { data } = await admin
    .from("seasons")
    .select("id, slug, name")
    .lte("start_date", firstDay)
    .gte("end_date", firstDay)
    .maybeSingle();
  return (data as { id: string; slug: string; name: string } | null) ?? null;
}

function monthLabel(monthValue: string): string {
  const [y, m] = monthValue.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export const getLeaderboard = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      game_id?: string | null;
      city?: string | null;
      store_id?: string | null;
      month?: string | null; // "YYYY-MM"
    }) =>
      z
        .object({
          game_id: z.string().uuid().nullable().optional(),
          city: z.string().max(120).nullable().optional(),
          store_id: z.string().uuid().nullable().optional(),
          month: z
            .string()
            .regex(/^\d{4}-\d{2}$/)
            .nullable()
            .optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }) => {
    const admin = getGeekarenaAdmin();

    // Resolve city → set of stores (used by both queries when city is set)
    let cityStoreIds: string[] | null = null;
    if (data.city) {
      const { data: cityStores, error } = await admin
        .from("stores")
        .select("id")
        .eq("is_active", true)
        .eq("city", data.city);
      if (error) throw new Error(error.message);
      cityStoreIds = (cityStores ?? []).map((s) => s.id);
    }

    // Resolve month: explicit or most recent available
    let monthValue = data.month;
    if (!monthValue) {
      const { data: latest } = await admin
        .from("tournaments")
        .select("qualifying_year, qualifying_month")
        .in("status", ["APPROVED", "PUBLISHED"])
        .order("qualifying_year", { ascending: false })
        .order("qualifying_month", { ascending: false })
        .limit(1);
      if (latest && latest.length > 0) {
        monthValue = `${latest[0].qualifying_year}-${String(latest[0].qualifying_month).padStart(2, "0")}`;
      } else {
        const now = new Date();
        monthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      }
    }
    const season = await getSeasonForMonth(admin, monthValue);
    const seasonKey = season?.slug ?? "";

    async function querySnapshots(
      timeframeType: "MONTHLY" | "SEMESTRAL",
      timeframeValue: string,
      opts: { applyStoreId: boolean },
    ) {
      if (!timeframeValue) return [];
      let q = admin
        .from("leaderboard_snapshots")
        .select("player_id, store_id, total_points, tournaments_played, tournaments_won, rank_position, omw_percentage")
        .eq("timeframe_type", timeframeType)
        .eq("timeframe_value", timeframeValue);
      if (data.game_id) q = q.eq("game_id", data.game_id);

      // store_id applies only to MONTHLY (explicit store filter)
      if (opts.applyStoreId && data.store_id) {
        q = q.eq("store_id", data.store_id);
      } else if (cityStoreIds) {
        // city filter applies to both tables
        if (cityStoreIds.length === 0) return [];
        q = q.in("store_id", cityStoreIds);
      }

      const { data: rows, error } = await q;
      if (error) {
        console.error(`[leaderboard] querySnapshots(${timeframeType}, ${timeframeValue}) failed:`, error.message);
        return [];
      }
      return rows ?? [];
    }

    const [monthlyRaw, semestralRaw] = await Promise.all([
      querySnapshots("MONTHLY", monthValue, { applyStoreId: true }),
      querySnapshots("SEMESTRAL", seasonKey, { applyStoreId: false }),
    ]);

    const playerIds = Array.from(new Set([...monthlyRaw, ...semestralRaw].map((r) => r.player_id)));
    const allStoreIds = Array.from(
      new Set([...monthlyRaw, ...semestralRaw].map((r) => r.store_id).filter((v): v is string => !!v)),
    );

    const [playersRes, storesRes] = await Promise.all([
      playerIds.length
        ? admin.from("players").select("id, geek_tag").in("id", playerIds)
        : Promise.resolve({ data: [], error: null } as const),
      allStoreIds.length
        ? admin.from("stores").select("id, city").in("id", allStoreIds)
        : Promise.resolve({ data: [], error: null } as const),
    ]);
    if (playersRes.error) throw new Error(playersRes.error.message);
    if (storesRes.error) throw new Error(storesRes.error.message);

    const playerMap = new Map((playersRes.data ?? []).map((p) => [p.id, p]));
    const storeMap = new Map((storesRes.data ?? []).map((s) => [s.id, s]));

    type Row = {
      player_id: string;
      geek_tag: string;
      city: string;
      points: number;
      tournaments_won: number;
      tournaments_played: number;
      omw_percentage: number;
      rank_position: number;
    };

    function shape(
      raws: Array<{
        player_id: string;
        store_id: string | null;
        total_points: number | null;
        tournaments_played: number | null;
        tournaments_won: number | null;
        omw_percentage: number | null;
        rank_position: number | null;
      }>,
    ): Row[] {
      // Aggregate by player (in case multiple store-scoped rows match)
      const agg = new Map<
        string,
        {
          points: number;
          won: number;
          played: number;
          cities: Set<string>;
          omw_sum: number;
          omw_count: number;
          best_rank: number | null;
        }
      >();
      for (const r of raws) {
        let a = agg.get(r.player_id);
        if (!a) {
          a = {
            points: 0,
            won: 0,
            played: 0,
            cities: new Set(),
            omw_sum: 0,
            omw_count: 0,
            best_rank: null,
          };
          agg.set(r.player_id, a);
        }
        a.points += r.total_points ?? 0;
        a.won += r.tournaments_won ?? 0;
        a.played += r.tournaments_played ?? 0;
        if (r.omw_percentage != null) {
          a.omw_sum += Number(r.omw_percentage);
          a.omw_count += 1;
        }
        if (r.rank_position != null) {
          a.best_rank = a.best_rank == null ? r.rank_position : Math.min(a.best_rank, r.rank_position);
        }
        const city = r.store_id ? storeMap.get(r.store_id)?.city : null;
        if (city) a.cities.add(city);
      }
      const sorted = Array.from(agg.entries())
        .map(([pid, a]) => ({
          player_id: pid,
          geek_tag: playerMap.get(pid)?.geek_tag ?? "—",
          city: a.cities.size === 1 ? Array.from(a.cities)[0] : a.cities.size > 1 ? "Varias" : "—",
          points: a.points,
          tournaments_won: a.won,
          tournaments_played: a.played,
          omw_percentage: a.omw_count > 0 ? Math.round((a.omw_sum / a.omw_count) * 100) / 100 : 0,
          best_rank: a.best_rank,
        }))
        .sort((x, y) => {
          // When a single snapshot per player matched (e.g. store filter),
          // use the canonical DB rank_position. Otherwise fall back to points.
          if (x.best_rank != null && y.best_rank != null && x.best_rank !== y.best_rank) {
            return x.best_rank - y.best_rank;
          }
          return y.points - x.points;
        });

      // Assign final rank_position based on sorted order. This is the canonical
      // value used by the UI — never recomputed in the client.
      return sorted.map((r, i) => ({
        player_id: r.player_id,
        geek_tag: r.geek_tag,
        city: r.city,
        points: r.points,
        tournaments_won: r.tournaments_won,
        tournaments_played: r.tournaments_played,
        omw_percentage: r.omw_percentage,
        rank_position: r.best_rank ?? i + 1,
      }));
    }

    return {
      monthly: shape(monthlyRaw),
      semestral: shape(semestralRaw),
      month_label: monthLabel(monthValue),
      semester_label: season?.name ?? "Sin temporada activa",
      month_value: monthValue,
      semester_key: seasonKey,
    };
  });

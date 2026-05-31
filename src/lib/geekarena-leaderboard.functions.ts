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

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function getSemesterKey(monthValue: string): string {
  const [year, month] = monthValue.split("-").map(Number);
  const semester = month <= 6 ? 1 : 2;
  return `${year}-S${semester}`;
}

function monthLabel(monthValue: string): string {
  const [y, m] = monthValue.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function semesterLabel(semesterKey: string): string {
  const [year, s] = semesterKey.split("-");
  return `${s} ${year}`;
}

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
    }

    // Resolve month: explicit or most recent available
    let monthValue = data.month;
    if (!monthValue) {
      let q = admin
        .from("tournaments")
        .select("qualifying_year, qualifying_month")
        .in("status", ["APPROVED", "PUBLISHED"])
        .order("qualifying_year", { ascending: false })
        .order("qualifying_month", { ascending: false })
        .limit(1);
      const { data: latest } = await q;
      if (latest && latest.length > 0) {
        monthValue = `${latest[0].qualifying_year}-${String(latest[0].qualifying_month).padStart(2, "0")}`;
      } else {
        const now = new Date();
        monthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      }
    }
    const semesterKey = getSemesterKey(monthValue);

    async function querySnapshots(
      timeframeType: "MONTHLY" | "SEMESTRAL",
      timeframeValue: string,
    ) {
      let q = admin
        .from("leaderboard_snapshots")
        .select(
          "player_id, store_id, total_points, tournaments_played, tournaments_won, rank_position",
        )
        .eq("timeframe_type", timeframeType)
        .eq("timeframe_value", timeframeValue);
      if (data.game_id) q = q.eq("game_id", data.game_id);
      if (storeIds) {
        if (storeIds.length === 0) return [];
        q = q.in("store_id", storeIds);
      }
      const { data: rows, error } = await q;
      if (error) {
        // The enum value may not yet exist in the database. Don't crash the
        // whole page — log it and return an empty bucket so the other table
        // still renders.
        console.error(
          `[leaderboard] querySnapshots(${timeframeType}, ${timeframeValue}) failed:`,
          error.message,
        );
        return [];
      }
      return rows ?? [];
    }

    const [monthlyRaw, semestralRaw] = await Promise.all([
      querySnapshots("MONTHLY", monthValue),
      querySnapshots("SEMESTRAL", semesterKey),
    ]);

    const playerIds = Array.from(
      new Set([...monthlyRaw, ...semestralRaw].map((r) => r.player_id)),
    );
    const allStoreIds = Array.from(
      new Set(
        [...monthlyRaw, ...semestralRaw]
          .map((r) => r.store_id)
          .filter((v): v is string => !!v),
      ),
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
      wins: number;
      losses: number;
    };

    function shape(
      raws: Array<{
        player_id: string;
        store_id: string | null;
        total_points: number | null;
        tournaments_played: number | null;
        tournaments_won: number | null;
      }>,
    ): Row[] {
      // Aggregate by player (in case multiple store-scoped rows match)
      const agg = new Map<
        string,
        { points: number; won: number; played: number; cities: Set<string> }
      >();
      for (const r of raws) {
        let a = agg.get(r.player_id);
        if (!a) {
          a = { points: 0, won: 0, played: 0, cities: new Set() };
          agg.set(r.player_id, a);
        }
        a.points += r.total_points ?? 0;
        a.won += r.tournaments_won ?? 0;
        a.played += r.tournaments_played ?? 0;
        const city = r.store_id ? storeMap.get(r.store_id)?.city : null;
        if (city) a.cities.add(city);
      }
      return Array.from(agg.entries())
        .map(([pid, a]) => ({
          player_id: pid,
          geek_tag: playerMap.get(pid)?.geek_tag ?? "—",
          city:
            a.cities.size === 1
              ? Array.from(a.cities)[0]
              : a.cities.size > 1
                ? "Varias"
                : "—",
          points: a.points,
          tournaments_won: a.won,
          wins: a.played,
          losses: 0,
        }))
        .sort((x, y) => y.points - x.points);
    }

    return {
      monthly: shape(monthlyRaw),
      semestral: shape(semestralRaw),
      month_label: monthLabel(monthValue),
      semester_label: semesterLabel(semesterKey),
      month_value: monthValue,
      semester_key: semesterKey,
    };
  });

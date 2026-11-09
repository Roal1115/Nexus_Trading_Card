// Public leaderboard reads. No auth middleware: data is public.
// All reads go through the admin client server-side to keep RLS simple.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getActiveSeason } from "./nexus-admin-core";
import { optionalNexusUser } from "./nexus-auth.middleware";
import { mostPlayedRegion, storeRegion } from "./store-regions";
import { getNexusAdmin, failDb } from "./nexus-admin.server";
import {
  monthRows,
  seasonRows,
  tableOf,
  type RankingEntry,
  type RankingRow,
} from "./nexus-rankings.server";

export const getLeaderboardOptions = createServerFn({ method: "POST" }).handler(async () => {
  const admin = getNexusAdmin();
  const [gamesRes, storesRes, monthsRes] = await Promise.all([
    admin.from("games").select("id, slug, name").eq("is_active", true).order("name"),
    admin
      .from("stores")
      .select("id, name, city, zone, subzone")
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
  if (gamesRes.error) failDb(gamesRes.error);
  if (storesRes.error) failDb(storesRes.error);
  if (monthsRes.error) failDb(monthsRes.error);

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
  admin: ReturnType<typeof getNexusAdmin>,
  monthValue: string,
): Promise<{ id: string; slug: string; name: string } | null> {
  const [year, month] = monthValue.split("-").map(Number);
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const { data } = await admin
    .from("seasons")
    .select("id, slug, name")
    .lte("start_date", firstDay)
    .gte("end_date", firstDay)
    .eq("is_active", true)
    .maybeSingle();
  return (data as { id: string; slug: string; name: string } | null) ?? null;
}

function monthLabel(monthValue: string): string {
  const [y, m] = monthValue.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function prevMonthValue(monthValue: string): string {
  const [year, month] = monthValue.split("-").map(Number);
  if (month === 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, "0")}`;
}

export const getLeaderboard = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      game_id?: string | null;
      zone?: string | null;
      region?: string | null;
      store_id?: string | null;
      month?: string | null;
    }) =>
      z
        .object({
          game_id: z.string().uuid().nullable().optional(),
          zone: z.string().max(60).nullable().optional(),
          region: z.string().max(120).nullable().optional(),
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
    const admin = getNexusAdmin();

    // 1. Resolver cityStoreIds
    let cityStoreIds: string[] | null = null;
    if (data.zone) {
      const { data: zoneStores, error } = await admin
        .from("stores")
        .select("id, city, subzone")
        .eq("is_active", true)
        .eq("zone", data.zone);
      if (error) failDb(error);
      cityStoreIds = (zoneStores ?? [])
        .filter((s) => !data.region || storeRegion(s) === data.region)
        .map((s) => s.id);
    }

    // 2. Resolver monthValue PRIMERO
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

    // 3. Calcular prevMonth y season (monthValue ya está resuelto)
    const prevMonth = prevMonthValue(monthValue);
    const season = await getSeasonForMonth(admin, monthValue);
    const seasonKey = season?.slug ?? "";

    // 4. Tabla Mensual: tope semanal sobre las tiendas del filtro.
    const inFilter = (rows: RankingRow[]) => {
      if (data.store_id) return rows.filter((r) => r.tournaments.store_id === data.store_id);
      if (!cityStoreIds) return rows;
      const ids = new Set(cityStoreIds);
      return rows.filter((r) => ids.has(r.tournaments.store_id));
    };
    const gameId = data.game_id;
    const [monthResults, prevResults, seasonResults] = gameId
      ? await Promise.all([
          monthRows(admin, gameId, monthValue),
          monthRows(admin, gameId, prevMonth),
          season ? seasonRows(admin, gameId, season.id) : [],
        ])
      : [[], [], []];
    const monthlyTable = tableOf(inFilter(monthResults));
    const prevRankMap = new Map(
      tableOf(inFilter(prevResults)).map((entry, i) => [entry.playerId, i + 1]),
    );

    // 5. Tabla General: puntos de todo el circuito, filtrando solo qué jugadores
    // aparecen (los que tienen resultados en la zona o región elegida).
    const zoneStoreIds = cityStoreIds && new Set(cityStoreIds);
    const semestralTable = tableOf(seasonResults).filter(
      (entry) => !zoneStoreIds || [...entry.storeIds].some((id) => zoneStoreIds.has(id)),
    );

    // 6. Datos para mostrar
    const shown = [...monthlyTable, ...semestralTable];
    const playerIds = Array.from(new Set(shown.map((entry) => entry.playerId)));
    const allStoreIds = Array.from(new Set(shown.flatMap((entry) => [...entry.storeIds])));

    const [playersRes, storesRes] = await Promise.all([
      playerIds.length
        ? admin.from("players").select("id, geek_tag").in("id", playerIds)
        : Promise.resolve({ data: [], error: null } as const),
      allStoreIds.length
        ? admin.from("stores").select("id, city").in("id", allStoreIds)
        : Promise.resolve({ data: [], error: null } as const),
    ]);
    if (playersRes.error) failDb(playersRes.error);
    if (storesRes.error) failDb(storesRes.error);

    const playerMap = new Map((playersRes.data ?? []).map((p) => [p.id, p]));
    const storeMap = new Map((storesRes.data ?? []).map((s) => [s.id, s]));

    // Positivo = subió; negativo = bajó; null = no jugó el mes anterior.
    const shape = (table: RankingEntry[]) =>
      table.map((entry, i) => {
        const cities = new Set([...entry.storeIds].flatMap((id) => storeMap.get(id)?.city ?? []));
        const prevRank = prevRankMap.get(entry.playerId) ?? null;
        return {
          player_id: entry.playerId,
          geek_tag: playerMap.get(entry.playerId)?.geek_tag ?? "—",
          city: cities.size === 1 ? [...cities][0] : cities.size > 1 ? "Varias" : "—",
          points: entry.points,
          tournaments_won: entry.won,
          tournaments_played: entry.played,
          omw_percentage: entry.omw,
          rank_position: i + 1,
          rank_delta: prevRank != null ? prevRank - (i + 1) : null,
        };
      });

    return {
      monthly: shape(monthlyTable),
      semestral: shape(semestralTable),
      month_label: monthLabel(monthValue),
      semester_label: season?.name ?? "Sin temporada activa",
      month_value: monthValue,
      semester_key: seasonKey,
    };
  });

/** Región que abre la Tabla Mensual de un jugador con sesión; null para visitantes. */
export const getMyDefaultRegion = createServerFn({ method: "POST" })
  .middleware([optionalNexusUser])
  .inputValidator((d: { game_id: string }) => z.object({ game_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { admin, player } = context;
    if (!player) return null;
    const [season, storesRes] = await Promise.all([
      getActiveSeason(admin),
      admin.from("stores").select("id, zone, subzone, city").eq("is_active", true),
    ]);
    if (storesRes.error) failDb(storesRes.error);
    const rows = season ? await seasonRows(admin, data.game_id, season.id) : [];
    const played = rows
      .filter((row) => row.player_id === player.id)
      .map((row) => ({
        store_id: row.tournaments.store_id,
        date: row.tournaments.tournament_date,
      }));
    return mostPlayedRegion(played, storesRes.data ?? [], player.home_store_id ?? null);
  });

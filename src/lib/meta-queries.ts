import { queryOptions, keepPreviousData } from "@tanstack/react-query";
import { getMetaStats, getMetaMatchups, getMetaFilterOptions } from "./nexus-meta.functions";

export type MetaFilters = {
  game_id: string;
  zone: string | null;
  store_id: string | null;
  date_from: string | null;
  date_to: string | null;
};

// Zonas/tiendas por juego cambian poco — staleTime más largo que los datos
// de meta en sí.
export const metaFilterOptionsQuery = (gameId: string) =>
  queryOptions({
    queryKey: ["meta-filter-options", gameId],
    queryFn: () => getMetaFilterOptions({ data: { game_id: gameId } }),
    staleTime: 5 * 60_000,
  });

// Stats + matchups se piden juntos (mismo filtro, mismo momento de carga en
// la página original) — una sola query, no dos con loading states separados.
// keepPreviousData sí aplica aquí (a diferencia del perfil de jugador): son
// el mismo dataset bajo un filtro distinto, no una entidad distinta.
export const metaQuery = (filters: MetaFilters) =>
  queryOptions({
    queryKey: ["meta-stats", filters],
    queryFn: async () => {
      const [stats, matchups] = await Promise.all([
        getMetaStats({ data: filters }),
        getMetaMatchups({ data: filters }),
      ]);
      return { stats, matchups };
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

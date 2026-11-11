import { queryOptions } from "@tanstack/react-query";
import {
  getMyStats,
  getMyStatsGames,
  getMyCasualStats,
  getMyPendingStats,
} from "./nexus-player.functions";

type StatsData = Awaited<ReturnType<typeof getMyStats>>;

export const myStatsGamesQuery = () =>
  queryOptions({
    queryKey: ["my-stats-games"],
    queryFn: () => getMyStatsGames(),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    // Nada invalida esta caché al crear una partida en "Mis partidas": sin esto, quien ya
    // había abierto "Mis stats" seguía viendo la lista vieja hasta 5 min después.
    refetchOnMount: "always",
  });

const FETCHERS = {
  official: getMyStats,
  casual: getMyCasualStats,
  pending: getMyPendingStats,
} as const;

// Una query por fuente (no una combinada para "all") — así cambiar de tab
// reutiliza lo que ya se cacheó bajo cada fuente en vez de refetchear todo.
export const myStatsSourceQuery = (gameId: string, source: "official" | "casual" | "pending") =>
  queryOptions({
    queryKey: ["my-stats", gameId, source],
    queryFn: () => FETCHERS[source]({ data: { game_id: gameId } }) as Promise<StatsData>,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    // Mismo motivo: registrar rondas en "Mis partidas" no invalida estas stats.
    refetchOnMount: "always",
  });

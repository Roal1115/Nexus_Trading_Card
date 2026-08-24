import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { getLeaderboard, getLeaderboardOptions } from "./nexus-leaderboard.functions";

export type LeaderboardFilters = {
  game_id: string | null;
  city: string | null;
  store_id: string | null;
  month: string | null;
};

export const leaderboardOptionsQuery = () =>
  queryOptions({
    queryKey: ["leaderboard-options"],
    queryFn: () => getLeaderboardOptions(),
    staleTime: 5 * 60_000,
  });

export const leaderboardQuery = (filters: LeaderboardFilters) =>
  queryOptions({
    queryKey: ["leaderboard", filters],
    queryFn: () => getLeaderboard({ data: filters }),
    staleTime: 60_000,
    // Al cambiar filtros, la tabla anterior permanece visible mientras llega la nueva.
    placeholderData: keepPreviousData,
  });

import { queryOptions } from "@tanstack/react-query";
import { getSeasonProfile } from "./nexus-season-profile.functions";

export const seasonProfileQuery = (playerTag: string, seasonId: string) =>
  queryOptions({
    queryKey: ["season-profile", playerTag, seasonId],
    queryFn: () => getSeasonProfile({ data: { player_tag: playerTag, season_id: seasonId } }),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

import { queryOptions } from "@tanstack/react-query";
import { getStandaloneSessions, getMyTrackedTournaments } from "./nexus-standalone.functions";

// Combinado en una sola query porque la página siempre pinta ambas listas
// juntas (torneos oficiales = matched sessions + tracked tournaments).
export const sessionsPageQuery = () =>
  queryOptions({
    queryKey: ["sessions-page"],
    queryFn: async () => {
      const [sessionsRes, trackedRes] = await Promise.all([
        getStandaloneSessions(),
        getMyTrackedTournaments(),
      ]);
      return { sessions: sessionsRes.sessions, tournaments: trackedRes.tournaments };
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

import { queryOptions } from "@tanstack/react-query";
import { getMyDashboard, getTournamentDetail } from "./nexus-player.functions";

export const myDashboardQuery = () =>
  queryOptions({
    queryKey: ["my-dashboard"],
    queryFn: () => getMyDashboard(),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

// Detalle del modal de torneo — reabrir el mismo torneo pinta desde caché
// en vez de repetir el fetch (antes: loadingDetail se reactivaba siempre).
export const tournamentDetailQuery = (tournamentId: string) =>
  queryOptions({
    queryKey: ["tournament-detail", tournamentId],
    queryFn: () => getTournamentDetail({ data: { tournament_id: tournamentId } }),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

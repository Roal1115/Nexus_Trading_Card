import { queryOptions } from "@tanstack/react-query";
import { getPublicProfile } from "./nexus-player.functions";

// No se usa placeholderData/keepPreviousData aquí: a diferencia de un filtro
// (mismo dataset, distinta forma), cambiar de playerTag apunta a otra
// entidad — mostrar el perfil ANTERIOR mientras carga el nuevo sería mostrar
// al jugador equivocado, no una versión "stale pero válida" de la respuesta.
export const playerProfileQuery = (playerTag: string) =>
  queryOptions({
    queryKey: ["player-profile", playerTag],
    queryFn: () => getPublicProfile({ data: { player_tag: playerTag } }),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

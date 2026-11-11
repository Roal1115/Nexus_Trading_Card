import { queryOptions } from "@tanstack/react-query";
import { getStoreFichas } from "./nexus-schedule-events.functions";
import {
  getPublicStoresList,
  getStoreActiveLeagues,
  getStoreProfile,
  getStoreTournamentHistory,
} from "./nexus-public.functions";

// Una consulta (no un useEffect con catch → []) para que un fallo de red conserve su error y la
// página pueda ofrecer "Reintentar" en vez de decir que la tienda no tiene liga.
export const storeLeaguesQuery = (slug: string | undefined) =>
  queryOptions({
    queryKey: ["store-leagues", slug],
    queryFn: () => getStoreActiveLeagues({ data: { slug: slug ?? "" } }),
    enabled: !!slug,
    staleTime: 60_000,
  });

export const publicStoresQuery = () =>
  queryOptions({
    queryKey: ["public-stores"],
    queryFn: () => getPublicStoresList(),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });

export const storeProfileQuery = (slug: string) =>
  queryOptions({
    queryKey: ["store-profile", slug],
    queryFn: () => getStoreProfile({ data: { slug } }),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

export const storeTournamentHistoryQuery = (slug: string) =>
  queryOptions({
    queryKey: ["store-tournament-history", slug],
    queryFn: () => getStoreTournamentHistory({ data: { slug } }),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

export const storeFichasQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store-fichas", storeId],
    queryFn: () => getStoreFichas({ data: { store_id: storeId } }),
    staleTime: 60_000,
  });

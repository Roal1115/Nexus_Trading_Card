import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { getPublicCalendar } from "./nexus-public.functions";

export type CalendarFilters = {
  game_id: string | null;
  zone: string | null;
  store_id: string | null;
  store_ids: string[] | null;
  week_start: string;
};

// Sin loader/SSR prefetch: game_id depende de activeTcg, que vive en
// localStorage (solo cliente) — no hay filtro "por defecto" confiable para
// precargar en el servidor, a diferencia de Meta/Player Profile.
export const publicCalendarQuery = (filters: CalendarFilters) =>
  queryOptions({
    queryKey: ["public-calendar", filters],
    queryFn: () => getPublicCalendar({ data: filters }),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

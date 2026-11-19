// Filtros puros de "Torneos recientes" del dashboard. Fechas en YYYY-MM-DD.
export type RecentFilters = {
  tcg: string | null;
  store: string | null;
  range: "all" | "month" | "season";
  result: "all" | "top4" | "positive";
};

export function filterRecentEvents<
  T extends {
    game_id: string | null;
    store: string;
    date: string;
    placement: number | null;
    wins: number | null;
    losses: number | null;
  },
>(events: T[], f: RecentFilters, ctx: { today: string; seasonStart: string | null }): T[] {
  const month = ctx.today.slice(0, 7);
  return events.filter(
    (e) =>
      (!f.tcg || e.game_id === f.tcg) &&
      (!f.store || e.store === f.store) &&
      (f.range === "all" ||
        (f.range === "month"
          ? e.date.slice(0, 7) === month
          : !ctx.seasonStart || e.date >= ctx.seasonStart)) &&
      (f.result === "all" ||
        (f.result === "top4"
          ? e.placement != null && e.placement <= 4
          : (e.wins ?? 0) > (e.losses ?? 0))),
  );
}

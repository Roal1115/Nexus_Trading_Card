import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, HelpCircle, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { errMsg } from "@/components/panel/dashboard-format";
import { LoadError } from "@/components/panel/dashboard";
import {
  PLAYER_STATUS_COLORS,
  PLAYER_STATUS_HELP,
  PLAYER_STATUS_LABELS,
  PLAYER_STATUSES,
  type PlayerStatus,
} from "@/lib/player-status";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { usePagination } from "@/hooks/use-pagination";
import { getStoreAnalytics } from "@/lib/nexus-organizer.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TablePager } from "@/components/ui/table-pager";
import { ScopeFilters } from "@/components/organizer/scope-filters";
import { SkeletonBlock, SkeletonLine } from "@/components/ui/skeleton-loader";

export const Route = createFileRoute("/organizer/players")({
  head: () => ({ meta: [{ title: "Jugadores — Nexus" }] }),
  component: OrganizerPlayersPage,
});

type AnalyticsResult = Awaited<ReturnType<typeof getStoreAnalytics>>;
type PlayerRow = AnalyticsResult["classification"][number];
type SortKey = "last_visit" | "tournaments" | "points";

const TABS: Array<{ value: "all" | PlayerStatus; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "frecuente", label: "Frecuentes" },
  { value: "por_recuperar", label: "Por recuperar" },
  { value: "nuevo", label: "Nuevos" },
  { value: "ocasional", label: "Ocasionales" },
];

const SORTERS: Record<SortKey, (a: PlayerRow, b: PlayerRow) => number> = {
  last_visit: (a, b) => b.last_visit.localeCompare(a.last_visit),
  tournaments: (a, b) => b.tournaments_in_range - a.tournaments_in_range,
  points: (a, b) => b.points - a.points,
};

// "jose" encuentra a "José": a nadie se le exige escribir acentos.
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function lastVisitText(days: number) {
  if (days <= 0) return "Vino hoy";
  return days === 1 ? "Vino ayer" : `Vino hace ${days} días`;
}

function PlayerItem({ player }: { player: PlayerRow }) {
  const detail =
    player.status === "por_recuperar"
      ? `Faltó a ${plural(player.missed_tournaments, "torneo")}`
      : `${plural(player.tournaments_in_range, "torneo")} · ${player.points} pts`;
  const color = PLAYER_STATUS_COLORS[player.status];
  return (
    <li className="border-t border-white/5 first:border-t-0">
      <Link
        to="/organizer/players/$playerId"
        params={{ playerId: player.player_id }}
        className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/5"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{player.geek_tag}</p>
          <p className="mt-0.5 text-xs text-gray-400">
            {detail} · {lastVisitText(player.days_since)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" style={{ borderColor: color, color }}>
            {PLAYER_STATUS_LABELS[player.status]}
          </Badge>
          <ChevronRight size={16} className="text-gray-500" aria-hidden />
        </div>
      </Link>
    </li>
  );
}

function OrganizerPlayersPage() {
  const { player, loading: roleLoading } = useNexusRole();
  const fetchAnalytics = useServerFn(getStoreAnalytics);

  const [data, setData] = useState<AnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | PlayerStatus>("all");
  const [sort, setSort] = useState<SortKey>("last_visit");

  const refresh = async (
    df?: string,
    dt?: string,
    gameId?: string | null,
    leagueId?: string | null,
  ) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetchAnalytics({
        data: {
          date_from: df || undefined,
          date_to: dt || undefined,
          game_id: gameId || undefined,
          league_id: leagueId ?? null,
        },
      });
      setData(res);
      if (!df) setDateFrom(res.range.start);
      if (!dt) setDateTo(res.range.end);
    } catch (e) {
      const message = errMsg(e);
      setLoadError(message);
      if (data) toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!player) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id]);

  const visible = useMemo(() => {
    const q = fold(query.trim());
    return (data?.classification ?? [])
      .filter((p) => tab === "all" || p.status === tab)
      .filter((p) => !q || fold(p.geek_tag).includes(q))
      .sort(SORTERS[sort]);
  }, [data, query, tab, sort]);

  const pager = usePagination(visible);

  const header = (
    <header>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">Mi tienda</p>
      <h1 className="mt-2 text-3xl font-bold text-white">Jugadores</h1>
      <p className="mt-1 text-sm text-gray-400">
        Quién viene a tu tienda y a quién conviene recuperar.
      </p>
    </header>
  );

  if (loadError && !data) {
    return (
      <div className="space-y-6">
        {header}
        <div className="glass rounded-2xl">
          <LoadError message={loadError} onRetry={() => void refresh()} />
        </div>
      </div>
    );
  }

  if (roleLoading || !data) {
    return (
      <div className="space-y-6">
        {header}
        <SkeletonBlock className="h-11 w-full rounded-xl" />
        <div className="glass space-y-4 rounded-2xl p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonLine width="w-40" height="h-4" />
              <SkeletonLine width="w-56" height="h-3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const countOf = (value: "all" | PlayerStatus) =>
    value === "all" ? data.classification.length : data.category_summary[value];

  const changeDate = (which: "from" | "to", value: string) => {
    const from = which === "from" ? value : dateFrom;
    const to = which === "to" ? value : dateTo;
    setDateFrom(from);
    setDateTo(to);
    if (from && to) void refresh(from, to, selectedGameId, selectedLeagueId);
  };

  return (
    <div className="space-y-4">
      {header}

      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3">
        <Search size={16} className="shrink-0 text-gray-500" aria-hidden />
        <Input
          type="search"
          aria-label="Buscar jugador"
          placeholder="Buscar jugador…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            pager.setPage(1);
          }}
          className="border-0 bg-transparent px-0 focus-visible:ring-0"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as typeof tab);
            pager.setPage(1);
          }}
        >
          <TabsList className="h-auto flex-wrap">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label} ({countOf(t.value)})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white"
            >
              <HelpCircle size={14} aria-hidden /> ¿Qué significa cada estado?
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 space-y-2 text-xs">
            {PLAYER_STATUSES.map((s) => (
              <p key={s}>
                <span className="font-semibold" style={{ color: PLAYER_STATUS_COLORS[s] }}>
                  {PLAYER_STATUS_LABELS[s]}:
                </span>{" "}
                {PLAYER_STATUS_HELP[s]}
              </p>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      <details className="glass rounded-2xl">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm text-gray-300">
          <SlidersHorizontal size={14} aria-hidden /> Filtros y orden
        </summary>
        <div className="space-y-3 border-t border-white/10 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="players-date-from" className="text-xs text-muted-foreground">
                Desde
              </Label>
              <Input
                id="players-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => changeDate("from", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="players-date-to" className="text-xs text-muted-foreground">
                Hasta
              </Label>
              <Input
                id="players-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => changeDate("to", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="players-sort" className="text-xs text-muted-foreground">
                Ordenar por
              </Label>
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger id="players-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last_visit">Última visita</SelectItem>
                  <SelectItem value="tournaments">Torneos</SelectItem>
                  <SelectItem value="points">Puntos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Liga (Circuito Nacional vs. ligas internas, nunca se mezclan) + TCG */}
          <ScopeFilters
            availableLeagues={data.available_leagues}
            selectedLeagueId={selectedLeagueId}
            onLeagueChange={(leagueId) => {
              setSelectedLeagueId(leagueId);
              void refresh(dateFrom, dateTo, selectedGameId, leagueId);
            }}
            games={data.game_breakdown}
            selectedGameId={selectedGameId}
            onGameChange={(gameId) => {
              setSelectedGameId(gameId);
              void refresh(dateFrom, dateTo, gameId, selectedLeagueId);
            }}
          />
          <p className="text-xs text-gray-500">
            Las fechas cambian los torneos y puntos que ves. El estado siempre es a fecha de hoy.
          </p>
        </div>
      </details>

      <section aria-busy={loading} className={loading ? "opacity-60" : undefined}>
        {pager.pageItems.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-gray-400">
            {query.trim()
              ? `No encontramos a nadie con "${query.trim()}".`
              : "Todavía no hay jugadores aquí."}
          </div>
        ) : (
          <>
            <ul className="glass overflow-hidden rounded-2xl">
              {pager.pageItems.map((p) => (
                <PlayerItem key={p.player_id} player={p} />
              ))}
            </ul>
            <TablePager
              page={pager.page}
              totalPages={pager.totalPages}
              onPageChange={pager.setPage}
            />
          </>
        )}
      </section>
    </div>
  );
}

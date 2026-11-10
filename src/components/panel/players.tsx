// Piezas compartidas de "Jugadores" (organizer, TCG manager). Cada panel trae sus
// datos y sus filtros; la búsqueda, los estados y la lista son iguales en todos.
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, HelpCircle, Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SkeletonBlock, SkeletonLine } from "@/components/ui/skeleton-loader";
import { TablePager } from "@/components/ui/table-pager";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePagination } from "@/hooks/use-pagination";
import { SearchInput } from "@/components/ui/search-input";
import {
  PLAYER_STATUS_COLORS,
  PLAYER_STATUS_HELP,
  PLAYER_STATUS_LABELS,
  PLAYER_STATUSES,
  type PlayerStatus,
} from "@/lib/player-status";
import { LoadError } from "./dashboard";
import { errMsg, formatDate } from "./dashboard-format";

type PlayerLink = "/organizer/players/$playerId" | "/tcg-manager/players/$playerId";
type PlayersPath = "/organizer/players" | "/tcg-manager/players";
type TournamentLink = "/organizer/tournaments/$id" | "/tcg-manager/tournaments/$id";
type SortKey = "last_visit" | "tournaments" | "points";

export type PlayerRow = {
  player_id: string;
  geek_tag: string;
  tournaments_in_range: number;
  points: number;
  status: PlayerStatus;
  missed_tournaments: number;
  last_visit: string;
  days_since: number;
};

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

function PlayerItem({ player, linkTo }: { player: PlayerRow; linkTo: PlayerLink }) {
  const detail =
    player.status === "por_recuperar"
      ? `Faltó a ${plural(player.missed_tournaments, "torneo")}`
      : `${plural(player.tournaments_in_range, "torneo")} · ${player.points} pts`;
  const color = PLAYER_STATUS_COLORS[player.status];
  return (
    <li className="border-t border-white/5 first:border-t-0">
      <Link
        to={linkTo}
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

export function PlayersSkeleton({ header }: { header: React.ReactNode }) {
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

export function PlayersBrowser({
  players,
  summary,
  busy,
  linkTo,
  filters,
}: {
  players: PlayerRow[];
  summary: Record<PlayerStatus, number>;
  busy: boolean;
  linkTo: PlayerLink;
  filters?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | PlayerStatus>("all");
  const [sort, setSort] = useState<SortKey>("last_visit");

  const visible = useMemo(() => {
    const q = fold(query.trim());
    return players
      .filter((p) => tab === "all" || p.status === tab)
      .filter((p) => !q || fold(p.geek_tag).includes(q))
      .sort(SORTERS[sort]);
  }, [players, query, tab, sort]);

  const pager = usePagination(visible);

  return (
    <>
      <div className="glass flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar jugador por Nexus Tag" />
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
                {t.label} ({t.value === "all" ? players.length : summary[t.value]})
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
          <div className="max-w-xs space-y-1">
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
          {filters}
        </div>
      </details>

      <section aria-busy={busy} className={busy ? "opacity-60" : undefined}>
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
                <PlayerItem key={p.player_id} player={p} linkTo={linkTo} />
              ))}
            </ul>
            <TablePager
              page={pager.page}
              totalPages={pager.totalPages}
              onPageChange={pager.setPage}
              total={pager.total}
              pageSize={pager.pageSize}
            />
          </>
        )}
      </section>
    </>
  );
}

type PlayerDetailData = {
  geek_tag: string;
  total_points: number;
  last_visit: string;
  tournaments: Array<{
    id: string;
    date: string;
    game: string;
    store?: string;
    rank: number;
    points: number;
  }>;
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-xs uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

export function PlayerStaffView({
  load,
  reloadKey,
  backTo,
  tournamentTo,
  subtitle,
}: {
  load: () => Promise<PlayerDetailData>;
  reloadKey: string;
  backTo: PlayersPath;
  tournamentTo: TournamentLink;
  subtitle: string;
}) {
  const [data, setData] = useState<PlayerDetailData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setLoadError(null);
    load()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(errMsg(e));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, attempt]);

  const back = (
    <Button variant="ghost" size="sm" asChild>
      <Link to={backTo}>
        <ArrowLeft size={14} className="mr-1" aria-hidden /> Jugadores
      </Link>
    </Button>
  );

  if (loadError) {
    return (
      <div className="space-y-3">
        {back}
        <div className="glass rounded-2xl">
          <LoadError message={loadError} onRetry={() => setAttempt((a) => a + 1)} />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        {back}
        <SkeletonBlock className="h-24 w-full rounded-2xl" />
        <SkeletonBlock className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {back}
      <header>
        <h1 className="break-words text-3xl font-bold text-white">{data.geek_tag}</h1>
        <p className="mt-1 text-sm text-gray-400">{subtitle}</p>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Torneos" value={data.tournaments.length} />
        <Stat label="Puntos" value={data.total_points} />
        <Stat label="Última visita" value={formatDate(data.last_visit)} />
      </section>

      <section aria-labelledby="player-tournaments">
        <h2 id="player-tournaments" className="mb-2 text-sm font-semibold text-white">
          Torneos
        </h2>
        <ul className="glass overflow-hidden rounded-2xl">
          {data.tournaments.map((t) => (
            <li key={t.id} className="border-t border-white/5 first:border-t-0">
              <Link
                to={tournamentTo}
                params={{ id: t.id }}
                className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {t.game}
                    {t.store ? ` · ${t.store}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {formatDate(t.date)} · Lugar {t.rank} · {t.points} pts
                  </p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-gray-500" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TrendingUp, Shield, Calendar, Swords, X, Search } from "lucide-react";
import { useTCG } from "@/context/tcg.context";
import { getMetaMatchups, getMetaStats } from "@/lib/nexus-meta.functions";
import { metaFilterOptionsQuery, metaQuery, type MetaFilters } from "@/lib/meta-queries";
import { SkeletonBlock } from "@/components/ui/skeleton-loader";
import { BlockSelect } from "@/components/ui/block-select";
import { shortLeaderName, setBadge } from "@/lib/leader-display";

const DEFAULT_GAME_ID = "5b608762-d0a3-4a93-9739-e5cd150b01cd";
const DEFAULT_FILTERS: MetaFilters = {
  game_id: DEFAULT_GAME_ID,
  zone: null,
  store_id: null,
  date_from: null,
  date_to: null,
};

export const Route = createFileRoute("/meta")({
  // Best effort (no relanza): calienta la caché para cuando el usuario
  // llega por hover/intent desde la nav. Usa los filtros por default —
  // si el TCG activo global difiere, el efecto de sync del componente
  // dispara su propio fetch, igual que el comportamiento anterior.
  //
  // Devuelve los datos (no solo los precarga): en SSR, este loader corre
  // contra el QueryClient del servidor, así que el server renderiza con
  // datos reales. El cliente hidrata con un QueryClient nuevo y vacío — sin
  // pasarle esto como initialData, la primera pintada del cliente mostraría
  // el skeleton mientras el server mostró la tabla → hydration mismatch
  // (se detectó así, con Playwright, antes de dar el fix por terminado).
  loader: async ({ context }) => {
    try {
      const [options, meta] = await Promise.all([
        context.queryClient.ensureQueryData(metaFilterOptionsQuery(DEFAULT_GAME_ID)),
        context.queryClient.ensureQueryData(metaQuery(DEFAULT_FILTERS)),
      ]);
      return { options, meta };
    } catch {
      return undefined;
    }
  },
  head: () => ({ meta: [{ title: "Meta — Nexus" }] }),
  component: MetaPage,
});

type MatchupData = Awaited<ReturnType<typeof getMetaMatchups>>;
type StatsLeader = Awaited<ReturnType<typeof getMetaStats>>["leaders"][number];

const COLOR_MAP: Record<string, string> = {
  Red: "bg-red-500",
  Blue: "bg-blue-500",
  Green: "bg-green-500",
  Yellow: "bg-yellow-400",
  Purple: "bg-purple-500",
  Black: "bg-gray-900 border border-white/20",
};

function ColorDots({ colors }: { colors: string[] }) {
  return (
    <div className="flex items-center gap-1">
      {colors.map((c) => (
        <span
          key={c}
          title={c}
          className={`h-2.5 w-2.5 rounded-full ${COLOR_MAP[c] ?? "bg-gray-600"}`}
        />
      ))}
    </div>
  );
}

function wrColor(wr: number | null): string {
  if (wr === null) return "text-gray-500";
  if (wr >= 55) return "text-emerald-400";
  if (wr >= 45) return "text-white";
  return "text-red-400";
}

function sameFilters(a: MetaFilters, b: MetaFilters): boolean {
  return (
    a.game_id === b.game_id &&
    a.zone === b.zone &&
    a.store_id === b.store_id &&
    a.date_from === b.date_from &&
    a.date_to === b.date_to
  );
}

function MetaPage() {
  const { activeTcg } = useTCG();
  const loaderData = Route.useLoaderData();

  // `filters` = draft (lo que el usuario está editando); `appliedFilters` =
  // lo que realmente dispara la query — reproduce el patrón "Aplicar/Limpiar
  // filtros" que ya existía (zona/tienda/fechas no auto-aplican). game_id es
  // la excepción: lo controla el TcgSwitcher global, no un select de esta
  // página, así que sí aplica de inmediato (igual que antes).
  const [filters, setFilters] = useState<MetaFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<MetaFilters>(DEFAULT_FILTERS);

  const optionsQuery = useQuery({
    ...metaFilterOptionsQuery(filters.game_id),
    initialData: filters.game_id === DEFAULT_GAME_ID ? loaderData?.options : undefined,
  });
  const metaQ = useQuery({
    ...metaQuery(appliedFilters),
    initialData: sameFilters(appliedFilters, DEFAULT_FILTERS) ? loaderData?.meta : undefined,
  });
  const filterOptions = optionsQuery.data;
  // isPending (no isFetching): con keepPreviousData, cambiar un filtro no
  // vuelve a mostrar el skeleton — la tabla anterior queda visible mientras
  // llegan los datos nuevos, igual que el leaderboard desde P0-04.
  const loading = metaQ.isPending;

  const handleGameChange = (gameId: string) => {
    setFilters((f) => ({ ...f, game_id: gameId }));
    setAppliedFilters((f) => ({ ...f, game_id: gameId }));
  };

  useEffect(() => {
    if (!activeTcg?.id || activeTcg.id === filters.game_id) return;
    handleGameChange(activeTcg.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTcg?.id]);

  const applyFilters = () => setAppliedFilters(filters);
  const clearFilters = () => {
    const reset: MetaFilters = { ...DEFAULT_FILTERS, game_id: filters.game_id };
    setFilters(reset);
    setAppliedFilters(reset);
  };

  const metaData = metaQ.data?.stats;
  const matchupData = metaQ.data?.matchups;
  const leaders = metaData?.leaders ?? [];

  // Click en una fila del leaderboard: perfil completo del líder — sus stats
  // agregados (ya vienen en la fila) + su fila de matchups contra TODOS los
  // líderes con datos, no solo el Top 10 de la matriz.
  const [leaderDetailId, setLeaderDetailId] = useState<string | null>(null);
  const leaderDetail = leaders.find((l) => l.leader_id === leaderDetailId) ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 pb-20">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary inline-flex items-center gap-2">
          <TrendingUp size={12} /> Meta
        </p>
        <h1 className="mt-1 text-3xl font-bold text-white">Meta Leaderboard</h1>
        <p className="mt-1 text-sm text-gray-400">
          Win rates y play rates calculados desde torneos oficiales publicados.
        </p>
      </header>

      {/* Filters */}
      <div className="glass mb-6 rounded-2xl p-4 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0 w-full max-w-full">
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-gray-500">
              Zona
            </label>
            <BlockSelect
              value={filters.zone}
              onChange={(v) => setFilters((f) => ({ ...f, zone: v }))}
              options={(filterOptions?.zones ?? []).map((z: string) => ({ value: z, label: z }))}
              placeholder="Todas las zonas"
            />
          </div>
          <div className="min-w-0 w-full max-w-full">
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-gray-500">
              Tienda
            </label>
            <BlockSelect
              value={filters.store_id}
              onChange={(v) => setFilters((f) => ({ ...f, store_id: v }))}
              options={(filterOptions?.stores ?? [])
                .filter((s: any) => !filters.zone || s.zone === filters.zone)
                .map((s: any) => ({ value: s.id, label: s.name }))}
              placeholder="Todas las tiendas"
            />
          </div>
          <div className="min-w-0 w-full max-w-full">
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-gray-500">
              Desde
            </label>
            <div className="relative min-w-0 w-full max-w-full">
              <Calendar
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                type="date"
                value={filters.date_from ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value || null }))}
                placeholder="mm/dd/yy"
                style={{ colorScheme: "dark", minWidth: 0 }}
                className="block w-full min-w-0 max-w-full appearance-none rounded-lg border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-white focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="min-w-0 w-full max-w-full">
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-gray-500">
              Hasta
            </label>
            <div className="relative min-w-0 w-full max-w-full">
              <Calendar
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                type="date"
                value={filters.date_to ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value || null }))}
                placeholder="mm/dd/yy"
                style={{ colorScheme: "dark", minWidth: 0 }}
                className="block w-full min-w-0 max-w-full appearance-none rounded-lg border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-white focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={clearFilters}
            className="rounded-md border border-white/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-300 hover:bg-white/[0.05] transition"
          >
            Limpiar filtros
          </button>
          <button
            onClick={applyFilters}
            className="rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground hover:bg-primary/90 transition"
          >
            Aplicar filtros
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[32px_1fr_80px_80px_90px_90px_70px_70px_70px] gap-2 px-4 py-2 text-[10px] uppercase tracking-widest text-gray-500 border-b border-white/10">
              <div>#</div>
              <div>Leader</div>
              <div>Set</div>
              <div>Colores</div>
              <div className="text-right">Play Rate</div>
              <div className="text-right">Win Rate</div>
              <div className="text-right">1st WR</div>
              <div className="text-right">2nd WR</div>
              <div className="text-right">Rondas</div>
            </div>

            {loading ? (
              <div className="space-y-2 p-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <SkeletonBlock key={i} className="h-12 rounded-lg" />
                ))}
              </div>
            ) : leaders.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm text-gray-400">Sin datos suficientes para mostrar el meta.</p>
                <p className="mt-2 text-xs text-gray-600">
                  Se requieren mínimo 5 rondas por leader.
                </p>
              </div>
            ) : (
              leaders.map((leader, index) => (
                <div
                  key={leader.leader_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setLeaderDetailId(leader.leader_id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setLeaderDetailId(leader.leader_id);
                    }
                  }}
                  className="grid cursor-pointer grid-cols-[32px_1fr_80px_80px_90px_90px_70px_70px_70px] gap-2 px-4 py-3 items-center border-b border-white/[0.05] hover:bg-white/[0.04] transition focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <div
                    className={`font-mono text-sm ${
                      index < 3 ? "text-primary font-bold" : "text-gray-400"
                    }`}
                  >
                    #{index + 1}
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    {leader.leader_image ? (
                      <img
                        src={leader.leader_image}
                        alt={leader.leader_name}
                        className="h-10 w-7 rounded-md border border-white/10 object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="flex h-10 w-7 items-center justify-center rounded-md border border-white/10 bg-black/30 flex-shrink-0">
                        <Shield size={12} className="text-gray-600" />
                      </div>
                    )}
                    <span className="text-sm font-semibold text-white truncate">
                      {leader.leader_name}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 truncate">{leader.card_set_id ?? "—"}</div>
                  <ColorDots colors={leader.colors} />
                  <div className="text-right font-mono text-sm font-bold text-primary">
                    {leader.play_rate}%
                  </div>
                  <div
                    className={`text-right font-mono text-sm font-bold ${wrColor(leader.win_rate)}`}
                  >
                    {leader.win_rate}%
                  </div>
                  <div className={`text-right font-mono text-xs ${wrColor(leader.first_win_rate)}`}>
                    {leader.first_win_rate != null ? `${leader.first_win_rate}%` : "—"}
                  </div>
                  <div
                    className={`text-right font-mono text-xs ${wrColor(leader.second_win_rate)}`}
                  >
                    {leader.second_win_rate != null ? `${leader.second_win_rate}%` : "—"}
                  </div>
                  <div className="text-right font-mono text-xs text-gray-400">
                    {leader.total_rounds}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-gray-600">
        Solo se muestran leaders con mínimo 5 rondas registradas (torneos oficiales + sessions).
        {" · "}
        {metaData?.total_rounds ?? 0} rondas totales en el meta.
      </p>

      {/* Matchups heatmap */}
      {!loading && matchupData && matchupData.leaders.length >= 2 && (
        <MatchupHeatmap data={matchupData} allLeaders={leaders} />
      )}

      <AnimatePresence>
        {leaderDetail && matchupData && (
          <LeaderDetailDrawer
            leader={leaderDetail}
            matchups={matchupData.matchups}
            allLeaders={leaders}
            onClose={() => setLeaderDetailId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function heatColor(wr: number): string {
  // rojo (0%) → gris (50%) → verde (100%), con alpha según distancia al 50
  const dist = Math.abs(wr - 50) / 50;
  const alpha = 0.12 + dist * 0.55;
  return wr >= 50 ? `rgba(52,211,153,${alpha})` : `rgba(248,113,113,${alpha})`;
}

type MetaLeader = MatchupData["leaders"][number];
type MetaCell = MatchupData["matchups"][string];

function leaderMatches(l: MetaLeader, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const badge = setBadge(l.card_set_id);
  const haystacks = [
    l.leader_name,
    shortLeaderName(l.leader_name),
    l.leader_id,
    l.card_set_id,
    badge,
  ];
  return haystacks.some((h) => h != null && h.toLowerCase().includes(q));
}

// OP17 antes que OP16 — resultados de búsqueda con el set más reciente primero.
function bySetBadgeDesc(a: MetaLeader, b: MetaLeader): number {
  const numOf = (l: MetaLeader) => {
    const badge = setBadge(l.card_set_id);
    const match = badge?.match(/\d+/);
    return match ? parseInt(match[0], 10) : -1;
  };
  return numOf(b) - numOf(a);
}

// Mismo layout que la card de matchup de /my-stats: portrait grande, nombre +
// badge + colores, y las tres filas WR/1st/2nd — reutilizamos el patrón que
// el usuario ya conoce de esa página en vez de inventar uno nuevo.
function MatchupCard({
  opp,
  cell,
  onClick,
}: {
  opp: MetaLeader;
  cell: MetaCell;
  onClick: () => void;
}) {
  const bucketBorder =
    cell.win_rate >= 55
      ? "border-t-emerald-400"
      : cell.win_rate >= 45
        ? "border-t-white/30"
        : "border-t-red-400";
  return (
    <button
      onClick={onClick}
      className={`rounded-b-lg rounded-t-sm border-t-2 ${bucketBorder} bg-white/[0.02] p-2 text-left transition hover:bg-white/5`}
    >
      {opp.leader_image ? (
        <img
          src={opp.leader_image}
          alt={opp.leader_name}
          className="mx-auto h-24 w-auto rounded-md border border-white/10 object-cover"
        />
      ) : (
        <div className="mx-auto flex h-24 w-16 items-center justify-center rounded-md border border-white/10 bg-black/30">
          <Shield size={18} className="text-gray-600" />
        </div>
      )}
      <p className="mt-1.5 flex items-center justify-center gap-1.5 truncate text-center text-xs font-semibold text-white">
        <span className="truncate">{shortLeaderName(opp.leader_name)}</span>
        {setBadge(opp.card_set_id) && (
          <span className="flex-shrink-0 rounded border border-white/10 bg-white/5 px-1 py-0.5 font-mono text-[9px] uppercase tracking-wide text-gray-400">
            {setBadge(opp.card_set_id)}
          </span>
        )}
      </p>
      {opp.colors && opp.colors.length > 0 && (
        <div className="mt-1 flex justify-center">
          <ColorDots colors={opp.colors} />
        </div>
      )}

      <div className="mt-2 space-y-1 border-t border-white/5 pt-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500">WR</span>
          <span className="font-mono text-xs">
            <span className={`font-bold ${matchupWrColor(cell.win_rate)}`}>{cell.win_rate}%</span>{" "}
            <span className="text-[10px] text-gray-600">{cell.total}p</span>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500">1st</span>
          <span className="font-mono text-xs">
            <span className={`font-bold ${matchupWrColor(cell.first_win_rate)}`}>
              {cell.first_win_rate != null ? `${cell.first_win_rate}%` : "—"}
            </span>{" "}
            <span className="text-[10px] text-gray-600">{cell.first_total}p</span>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500">2nd</span>
          <span className="font-mono text-xs">
            <span className={`font-bold ${matchupWrColor(cell.second_win_rate)}`}>
              {cell.second_win_rate != null ? `${cell.second_win_rate}%` : "—"}
            </span>{" "}
            <span className="text-[10px] text-gray-600">{cell.second_total}p</span>
          </span>
        </div>
      </div>
    </button>
  );
}

function LeaderSearchResult({ l, onSelect }: { l: MetaLeader; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/5"
    >
      {l.leader_image ? (
        <img
          src={l.leader_image}
          alt={l.leader_name}
          className="h-9 w-6 flex-shrink-0 rounded border border-white/10 object-cover"
        />
      ) : (
        <div className="flex h-9 w-6 flex-shrink-0 items-center justify-center rounded border border-white/10 bg-black/30">
          <Shield size={10} className="text-gray-600" />
        </div>
      )}
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span className="truncate text-white">{shortLeaderName(l.leader_name)}</span>
        {setBadge(l.card_set_id) && (
          <span className="flex-shrink-0 rounded border border-white/10 bg-white/5 px-1 py-0.5 font-mono text-[9px] uppercase tracking-wide text-gray-400">
            {setBadge(l.card_set_id)}
          </span>
        )}
        {l.colors && l.colors.length > 0 && <ColorDots colors={l.colors} />}
      </span>
    </button>
  );
}

function MatchupHeatmap({ data, allLeaders }: { data: MatchupData; allLeaders: MetaLeader[] }) {
  const { leaders, matchups } = data;
  // Foco desktop: click en una fila/columna "pinea" ese líder — resalta su
  // fila+columna y atenúa el resto, así el ojo no tiene que sostener dos
  // posiciones en memoria mientras traza la intersección.
  const [activeId, setActiveId] = useState<string | null>(null);
  const toggleActive = (id: string) => setActiveId((cur) => (cur === id ? null : id));

  // Click en una celda (desktop) o en una card de matchup abre el detalle
  // del enfrentamiento — el matchup exacto, no solo el líder.
  const [selectedMatchup, setSelectedMatchup] = useState<{
    a: MetaLeader;
    b: MetaLeader;
    cell: MetaCell;
  } | null>(null);

  // Explorador: buscar CUALQUIER líder elegible (no solo el Top 10 de la
  // matriz) y ver su fila de matchups. Los datos ya están en `matchups`
  // (el backend ya no los limita al Top 10), así que esto es 100% client-side.
  const [exploreQuery, setExploreQuery] = useState("");
  const [exploringId, setExploringId] = useState<string | null>(null);
  const exploringLeader = exploringId
    ? (allLeaders.find((l) => l.leader_id === exploringId) ?? null)
    : null;
  const exploreResults = exploreQuery.trim()
    ? allLeaders
        .filter((l) => leaderMatches(l, exploreQuery))
        .sort(bySetBadgeDesc)
        .slice(0, 8)
    : [];

  const [mobileQuery, setMobileQuery] = useState("");
  const [mobileLeaderId, setMobileLeaderId] = useState<string>(leaders[0]?.leader_id ?? "");
  const mobileLeader =
    allLeaders.find((l) => l.leader_id === mobileLeaderId) ?? allLeaders[0] ?? null;
  const mobileResults = mobileQuery.trim()
    ? allLeaders
        .filter((l) => leaderMatches(l, mobileQuery))
        .sort(bySetBadgeDesc)
        .slice(0, 8)
    : [];

  const matchupRow = (leaderId: string) =>
    allLeaders
      .filter((l) => l.leader_id !== leaderId)
      .map((opp) => ({ opp, cell: matchups[`${leaderId}|${opp.leader_id}`] }))
      .filter((r): r is { opp: MetaLeader; cell: MetaCell } => Boolean(r.cell))
      .sort((a, b) => b.cell.win_rate - a.cell.win_rate);

  return (
    <section className="mt-10">
      <header className="mb-4">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
          <Swords size={12} /> Matchups
        </p>
        <h2 className="mt-1 text-xl font-bold text-white">Matriz de enfrentamientos</h2>
        <p className="mt-1 text-sm text-gray-400">
          Win rate del líder de la fila contra el líder de la columna. Mínimo 3 rondas por matchup ·
          Top 10 líderes por popularidad.
        </p>
      </header>

      {/* Desktop */}
      <div className="glass hidden rounded-2xl p-4 md:block">
        <div className="relative mb-4 max-w-xs">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="search"
            value={exploreQuery}
            onChange={(e) => setExploreQuery(e.target.value)}
            placeholder="Explorar un líder..."
            aria-label="Explorar un líder"
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2 pl-9 pr-8 text-sm text-white placeholder:text-gray-600 focus:border-primary/50 focus:outline-none"
          />
          {exploreQuery && (
            <button
              onClick={() => setExploreQuery("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
          {exploreResults.length > 0 && (
            <div className="absolute z-20 mt-1 w-full max-w-xs rounded-lg border border-white/10 bg-[#0B1220] p-1 shadow-xl">
              {exploreResults.map((l) => (
                <LeaderSearchResult
                  key={l.leader_id}
                  l={l}
                  onSelect={() => {
                    setExploringId(l.leader_id);
                    setExploreQuery("");
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {exploringLeader ? (
          <div>
            <button
              onClick={() => setExploringId(null)}
              className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              ← Volver al Top 10
            </button>
            <div className="flex flex-col items-center gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center">
              {exploringLeader.leader_image ? (
                <img
                  src={exploringLeader.leader_image}
                  alt={exploringLeader.leader_name}
                  className="h-20 w-14 flex-shrink-0 rounded-md border border-white/10 object-cover"
                />
              ) : (
                <div className="flex h-20 w-14 flex-shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/30">
                  <Shield size={16} className="text-gray-600" />
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-primary">
                  Explorando líder
                </p>
                <div className="mt-0.5 inline-flex items-center gap-1.5">
                  <span className="text-lg font-bold text-white">
                    {shortLeaderName(exploringLeader.leader_name)}
                  </span>
                  {setBadge(exploringLeader.card_set_id) && (
                    <span className="rounded border border-white/10 bg-white/5 px-1 py-0.5 font-mono text-[9px] uppercase tracking-wide text-gray-400">
                      {setBadge(exploringLeader.card_set_id)}
                    </span>
                  )}
                  {exploringLeader.colors && exploringLeader.colors.length > 0 && (
                    <ColorDots colors={exploringLeader.colors} />
                  )}
                </div>
              </div>
            </div>
            <div
              className="mt-4 grid gap-2.5"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))" }}
            >
              {matchupRow(exploringLeader.leader_id).length === 0 ? (
                <p className="col-span-full py-8 text-center text-xs text-gray-500">
                  Sin matchups con datos suficientes para {exploringLeader.leader_name}.
                </p>
              ) : (
                matchupRow(exploringLeader.leader_id).map(({ opp, cell }) => (
                  <MatchupCard
                    key={opp.leader_id}
                    opp={opp}
                    cell={cell}
                    onClick={() => setSelectedMatchup({ a: exploringLeader, b: opp, cell })}
                  />
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-1.5">
              <thead>
                <tr>
                  <th />
                  {leaders.map((l) => (
                    <th
                      key={l.leader_id}
                      className={`cursor-pointer pb-1 align-bottom transition-opacity ${
                        activeId && activeId !== l.leader_id ? "opacity-35" : "opacity-100"
                      }`}
                      title={l.leader_name}
                      onClick={() => toggleActive(l.leader_id)}
                    >
                      {l.leader_image ? (
                        <img
                          src={l.leader_image}
                          alt={l.leader_name}
                          className="mx-auto h-16 w-11 rounded-md border border-white/10 object-cover"
                        />
                      ) : (
                        <div className="mx-auto flex h-16 w-11 items-center justify-center rounded-md border border-white/10 bg-black/30">
                          <Shield size={14} className="text-gray-600" />
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaders.map((row) => (
                  <tr key={row.leader_id}>
                    <th
                      className={`cursor-pointer pr-2 text-right text-xs font-semibold whitespace-nowrap transition-opacity ${
                        activeId && activeId !== row.leader_id ? "opacity-35" : "opacity-100"
                      } ${activeId === row.leader_id ? "text-primary" : "text-white"}`}
                      title={row.leader_name}
                      onClick={() => toggleActive(row.leader_id)}
                    >
                      <span className="inline-flex items-center gap-2">
                        <span className="max-w-[130px] truncate">
                          {shortLeaderName(row.leader_name)}
                        </span>
                        {setBadge(row.card_set_id) && (
                          <span className="flex-shrink-0 rounded border border-white/10 bg-white/5 px-1 py-0.5 font-mono text-[9px] uppercase tracking-wide text-gray-400">
                            {setBadge(row.card_set_id)}
                          </span>
                        )}
                        {row.colors && row.colors.length > 0 && <ColorDots colors={row.colors} />}
                        {row.leader_image ? (
                          <img
                            src={row.leader_image}
                            alt=""
                            className="h-12 w-8 rounded-md border border-white/10 object-cover"
                          />
                        ) : null}
                      </span>
                    </th>
                    {leaders.map((col) => {
                      const dimmed =
                        !!activeId && activeId !== row.leader_id && activeId !== col.leader_id;
                      if (row.leader_id === col.leader_id) {
                        return (
                          <td
                            key={col.leader_id}
                            className={`h-16 w-20 rounded-md bg-white/[0.03] text-center text-xs text-gray-700 transition-opacity ${dimmed ? "opacity-35" : ""}`}
                          >
                            —
                          </td>
                        );
                      }
                      const cell = matchups[`${row.leader_id}|${col.leader_id}`];
                      if (!cell) {
                        return (
                          <td
                            key={col.leader_id}
                            className={`h-16 w-20 rounded-md bg-white/[0.02] text-center text-xs text-gray-700 transition-opacity ${dimmed ? "opacity-35" : ""}`}
                            title={`${row.leader_name} vs ${col.leader_name}: sin datos suficientes`}
                          >
                            ·
                          </td>
                        );
                      }
                      return (
                        <td
                          key={col.leader_id}
                          className={`h-16 w-20 cursor-pointer rounded-md text-center align-middle transition-opacity hover:ring-1 hover:ring-white/30 ${dimmed ? "opacity-35" : ""}`}
                          style={{ backgroundColor: heatColor(cell.win_rate) }}
                          title={`${row.leader_name} vs ${col.leader_name}: ${cell.win_rate}% (${cell.wins}-${cell.total - cell.wins}, ${cell.total} rondas) — click para detalle`}
                          onClick={() => setSelectedMatchup({ a: row, b: col, cell })}
                        >
                          <div className="font-mono text-sm font-bold text-white">
                            {cell.win_rate}%
                          </div>
                          <div className="text-[10px] text-white/60">{cell.total} rondas</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-center text-[11px] text-gray-600">
              Click en un líder para resaltar su fila y columna · click en una celda para ver el
              detalle del matchup · verde: favorable para la fila · rojo: desfavorable.
            </p>
          </div>
        )}
      </div>

      {/* Mobile: siempre explorador por líder — una fila de matchups como lista */}
      <div className="glass rounded-2xl p-4 md:hidden">
        <label className="mb-2 block text-[10px] uppercase tracking-widest text-gray-500">
          Buscar líder
        </label>
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="search"
            value={mobileQuery}
            onChange={(e) => setMobileQuery(e.target.value)}
            placeholder="Buscar líder..."
            aria-label="Buscar líder"
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-white placeholder:text-gray-600 focus:border-primary/50 focus:outline-none"
          />
        </div>
        {mobileResults.length > 0 && (
          <div className="mt-1 rounded-lg border border-white/10 bg-black/20 p-1">
            {mobileResults.map((l) => (
              <LeaderSearchResult
                key={l.leader_id}
                l={l}
                onSelect={() => {
                  setMobileLeaderId(l.leader_id);
                  setMobileQuery("");
                }}
              />
            ))}
          </div>
        )}
        {mobileLeader && (
          <div className="mt-4">
            <div className="mb-3 flex items-center gap-2">
              {mobileLeader.leader_image ? (
                <img
                  src={mobileLeader.leader_image}
                  alt={mobileLeader.leader_name}
                  className="h-10 w-7 flex-shrink-0 rounded border border-white/10 object-cover"
                />
              ) : null}
              <div>
                <p className="text-[9px] uppercase tracking-widest text-primary">
                  Explorando líder
                </p>
                <p className="text-sm font-bold text-white">
                  {shortLeaderName(mobileLeader.leader_name)}
                </p>
              </div>
            </div>
            <div
              className="grid gap-2.5"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))" }}
            >
              {matchupRow(mobileLeader.leader_id).length === 0 ? (
                <p className="col-span-full py-6 text-center text-xs text-gray-500">
                  Sin matchups con datos suficientes para {mobileLeader.leader_name}.
                </p>
              ) : (
                matchupRow(mobileLeader.leader_id).map(({ opp, cell }) => (
                  <MatchupCard
                    key={opp.leader_id}
                    opp={opp}
                    cell={cell}
                    onClick={() => setSelectedMatchup({ a: mobileLeader, b: opp, cell })}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedMatchup && (
          <MatchupDrawer
            a={selectedMatchup.a}
            b={selectedMatchup.b}
            cell={selectedMatchup.cell}
            onClose={() => setSelectedMatchup(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function matchupWrColor(wr: number | null): string {
  if (wr === null) return "text-gray-600";
  if (wr >= 55) return "text-emerald-400";
  if (wr >= 45) return "text-white";
  return "text-red-400";
}

function LeaderIdentity({ leader }: { leader: MetaLeader }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      {leader.leader_image ? (
        <img
          src={leader.leader_image}
          alt={leader.leader_name}
          className="h-24 w-16 rounded-md border border-white/10 object-cover"
        />
      ) : (
        <div className="flex h-24 w-16 items-center justify-center rounded-md border border-white/10 bg-black/30">
          <Shield size={18} className="text-gray-600" />
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold text-white">{shortLeaderName(leader.leader_name)}</span>
        {setBadge(leader.card_set_id) && (
          <span className="flex-shrink-0 rounded border border-white/10 bg-white/5 px-1 py-0.5 font-mono text-[9px] uppercase tracking-wide text-gray-400">
            {setBadge(leader.card_set_id)}
          </span>
        )}
      </div>
      {leader.colors && leader.colors.length > 0 && <ColorDots colors={leader.colors} />}
    </div>
  );
}

function MatchupDrawer({
  a,
  b,
  cell,
  onClose,
}: {
  a: MetaLeader;
  b: MetaLeader;
  cell: MetaCell;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows: Array<{ label: string; wr: number | null; total: number }> = [
    { label: "Win rate", wr: cell.win_rate, total: cell.total },
    { label: "Yendo primero", wr: cell.first_win_rate, total: cell.first_total },
    { label: "Yendo segundo", wr: cell.second_win_rate, total: cell.second_total },
  ];

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={`${a.leader_name} vs ${b.leader_name}`}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
        className="fixed right-0 top-0 bottom-0 z-[71] flex w-full max-w-md flex-col overflow-y-auto border-l border-white/10 bg-[#0B1220]/95 backdrop-blur-xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-end border-b border-white/10 bg-[#0B1220]/95 p-3 backdrop-blur-xl">
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition hover:text-white"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex items-center justify-center gap-4">
            <LeaderIdentity leader={a} />
            <span className="flex-shrink-0 font-mono text-xs uppercase tracking-widest text-gray-500">
              vs
            </span>
            <LeaderIdentity leader={b} />
          </div>

          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2.5"
              >
                <span className="text-xs text-gray-400">{r.label}</span>
                <span className="font-mono text-sm">
                  <span className={`font-bold ${matchupWrColor(r.wr)}`}>
                    {r.wr != null ? `${r.wr}%` : "—"}
                  </span>{" "}
                  <span className="text-[11px] text-gray-600">{r.total} rondas</span>
                </span>
              </div>
            ))}
          </div>

          <p className="text-center text-[11px] text-gray-600">
            Mínimo 3 rondas por matchup para mostrar datos.
          </p>
        </div>
      </motion.aside>
    </>
  );
}

function StatTile({
  label,
  wr,
  value,
  sub,
}: {
  label: string;
  wr?: number | null;
  value?: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-center">
      <p className="text-[10px] uppercase tracking-widest text-gray-500">{label}</p>
      <p
        className={`mt-1 font-mono text-lg font-bold ${value != null ? "text-white" : wrColor(wr ?? null)}`}
      >
        {value ?? (wr != null ? `${wr}%` : "—")}
      </p>
      <p className="text-[10px] text-gray-600">{sub}</p>
    </div>
  );
}

// Perfil completo de un líder desde el leaderboard: sus stats agregados (ya
// vienen en la fila del leaderboard) + su fila de matchups contra TODOS los
// líderes con datos suficientes, no solo el Top 10 de la matriz.
function LeaderDetailDrawer({
  leader,
  matchups,
  allLeaders,
  onClose,
}: {
  leader: StatsLeader;
  matchups: MatchupData["matchups"];
  allLeaders: StatsLeader[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [selectedMatchup, setSelectedMatchup] = useState<{
    a: StatsLeader;
    b: StatsLeader;
    cell: MetaCell;
  } | null>(null);

  const rows = allLeaders
    .filter((l) => l.leader_id !== leader.leader_id)
    .map((opp) => ({ opp, cell: matchups[`${leader.leader_id}|${opp.leader_id}`] }))
    .filter((r): r is { opp: StatsLeader; cell: MetaCell } => Boolean(r.cell))
    .sort((a, b) => b.cell.win_rate - a.cell.win_rate);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={leader.leader_name}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
        className="fixed right-0 top-0 bottom-0 z-[71] flex w-full max-w-xl flex-col overflow-y-auto border-l border-white/10 bg-[#0B1220]/95 backdrop-blur-xl"
      >
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-[#0B1220]/95 p-4 backdrop-blur-xl">
          {leader.leader_image ? (
            <img
              src={leader.leader_image}
              alt={leader.leader_name}
              className="h-14 w-10 flex-shrink-0 rounded-md border border-white/10 object-cover"
            />
          ) : (
            <div className="flex h-14 w-10 flex-shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/30">
              <Shield size={16} className="text-gray-600" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-lg font-bold text-white">
                {shortLeaderName(leader.leader_name)}
              </h2>
              {setBadge(leader.card_set_id) && (
                <span className="flex-shrink-0 rounded border border-white/10 bg-white/5 px-1 py-0.5 font-mono text-[9px] uppercase tracking-wide text-gray-400">
                  {setBadge(leader.card_set_id)}
                </span>
              )}
              {leader.colors && leader.colors.length > 0 && <ColorDots colors={leader.colors} />}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition hover:text-white"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-5 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatTile
              label="Win Rate"
              wr={leader.win_rate}
              sub={`${leader.total_rounds} partidas`}
            />
            <StatTile
              label="Yendo primero"
              wr={leader.first_win_rate}
              sub={`${leader.first_rounds} partidas`}
            />
            <StatTile
              label="Yendo segundo"
              wr={leader.second_win_rate}
              sub={`${leader.second_rounds} partidas`}
            />
            <StatTile
              label="Torneos Ganados"
              value={`${leader.tournaments_won}`}
              sub={leader.tournaments_won > 0 ? "🏆 campeonatos" : "sin torneos ganados"}
            />
            <StatTile
              label="Total de Partidas"
              value={`${leader.total_rounds}`}
              sub="registradas"
            />
          </div>

          <div>
            <p className="mb-2 text-[10px] uppercase tracking-widest text-gray-500">
              Matchups contra todos los líderes registrados
            </p>
            {rows.length === 0 ? (
              <p className="py-8 text-center text-xs text-gray-500">
                Sin matchups con datos suficientes para {leader.leader_name}.
              </p>
            ) : (
              <div
                className="grid gap-2.5"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))" }}
              >
                {rows.map(({ opp, cell }) => (
                  <MatchupCard
                    key={opp.leader_id}
                    opp={opp}
                    cell={cell}
                    onClick={() => setSelectedMatchup({ a: leader, b: opp, cell })}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      <AnimatePresence>
        {selectedMatchup && (
          <MatchupDrawer
            a={selectedMatchup.a}
            b={selectedMatchup.b}
            cell={selectedMatchup.cell}
            onClose={() => setSelectedMatchup(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

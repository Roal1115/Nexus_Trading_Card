import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Search } from "lucide-react";
import { toast } from "sonner";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useHidesOthersDecks, useNexusRole } from "@/hooks/use-nexus-role";

import { useQuery } from "@tanstack/react-query";
import { useTCG } from "@/context/tcg.context";
import { leaderboardOptionsQuery, leaderboardQuery } from "@/lib/leaderboard-queries";
import { getMyDefaultRegion } from "@/lib/nexus-leaderboard.functions";
import { listActiveSponsors, getActiveBanner } from "@/lib/nexus-ads.functions";
import { AdVertical } from "@/components/ads/AdVertical";
import { AdHorizontal } from "@/components/ads/AdHorizontal";
import { AdCarousel } from "@/components/ads/AdCarousel";
import { PillSelect } from "@/components/ui/pill-select";
import { PODIUM_TEXT, RankingBand } from "@/components/ranking/RankingBand";
import { regionsForZone, storeRegion } from "@/lib/store-regions";

type Period = "monthly" | "semestral";

type LeaderboardSearch = {
  zone?: string;
  region?: string;
  store?: string;
  month?: string;
  q?: string;
  period?: Period;
};

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): LeaderboardSearch => ({
    zone: typeof s.zone === "string" && s.zone ? s.zone : undefined,
    region: typeof s.region === "string" && s.region ? s.region : undefined,
    store: typeof s.store === "string" && s.store ? s.store : undefined,
    month: typeof s.month === "string" && /^\d{4}-\d{2}$/.test(s.month) ? s.month : undefined,
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    period: s.period === "semestral" ? "semestral" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Ranking nacional | Nexus" },
      {
        name: "description",
        content:
          "El ranking oficial del circuito nacional de TCG en México: posiciones por mes y por temporada, con filtros por zona, región y tienda.",
      },
    ],
  }),
  component: LeaderboardPage,
});

type Store = {
  id: string;
  name: string;
  city: string | null;
  zone: string | null;
  subzone: string | null;
};
type Row = {
  player_id: string;
  geek_tag: string;
  city: string;
  points: number;
  tournaments_won: number;
  tournaments_played: number;
  omw_percentage: number;
  rank_position: number;
  rank_delta: number | null;
};

const ALL = "__all__";
const ALL_ZONES_PARAM = "all";

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function monthLabel(m: string): string {
  const [y, mm] = m.split("-").map(Number);
  return `${MONTH_NAMES[mm - 1]} ${y}`;
}

const BTN_OUTLINE =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-foreground-secondary transition hover:bg-white/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 md:min-h-9";

const GRID_DESKTOP = "grid-cols-[64px_minmax(0,1fr)_minmax(0,120px)_72px_64px_72px_64px]";
const GRID_MOBILE = "grid-cols-[48px_minmax(0,1fr)_auto]";

function PeriodSegmentedControl({
  period,
  onChange,
}: {
  period: Period;
  onChange: (p: Period) => void;
}) {
  const options: Array<{ value: Period; label: string }> = [
    { value: "monthly", label: "Tabla Mensual" },
    { value: "semestral", label: "Tabla General" },
  ];
  return (
    <div
      role="group"
      aria-label="Periodo del ranking"
      className="inline-flex gap-1 rounded-md border border-border bg-background p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={period === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 cursor-pointer rounded px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 md:min-h-8 ${
            period === o.value
              ? "bg-primary/15 text-primary"
              : "text-foreground-secondary hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function LeaderboardPage() {
  const fetchActiveSponsors = useServerFn(listActiveSponsors);
  const fetchBanner = useServerFn(getActiveBanner);
  const { player: viewer, role, loading: authLoading } = useNexusRole();
  const myNexusTag = viewer?.geek_tag ?? null;
  const hidesOthersDecks = useHidesOthersDecks();

  const isStaff = role === "admin" || role === "tcg_manager" || role === "organizer";

  const [activeSponsor, setActiveSponsor] = useState<any>(null);
  const [allSponsors, setAllSponsors] = useState<any[]>([]);

  useEffect(() => {
    if (isStaff) return;
    fetchBanner()
      .then((r) => setActiveSponsor(r.sponsor))
      .catch(() => {});
    fetchActiveSponsors()
      .then(setAllSponsors)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // La URL es la única fuente de verdad de filtros y búsqueda (compartible,
  // sobrevive atrás/adelante y refresh). La temporada 1 es solo One Piece.
  const urlSearch = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const storeId = urlSearch.store ?? ALL;
  const month = urlSearch.month ?? ALL;
  const search = urlSearch.q ?? "";
  const period: Period = urlSearch.period ?? "monthly";
  const { activeTcg } = useTCG();

  // Sin filtros, la Tabla Mensual de un jugador abre en su región. No se escribe
  // en la URL: "zone=all" guarda que eligió ver todo y un link explícito no cambia.
  const autoRegion = period === "monthly" && !urlSearch.zone && !urlSearch.store;
  const fetchDefaultRegion = useServerFn(getMyDefaultRegion);
  const defaultRegionQuery = useQuery({
    queryKey: ["my-default-region", viewer?.id, activeTcg?.id],
    queryFn: () => fetchDefaultRegion({ data: { game_id: activeTcg!.id } }),
    enabled: autoRegion && !!viewer && !!activeTcg,
    staleTime: 5 * 60_000,
  });
  const suggested = autoRegion && viewer ? (defaultRegionQuery.data ?? null) : null;
  const regionReady = !autoRegion || (!authLoading && (!viewer || defaultRegionQuery.isFetched));

  const urlZone = urlSearch.zone === ALL_ZONES_PARAM ? undefined : urlSearch.zone;
  const zone = suggested?.zone ?? urlZone ?? ALL;
  const region = zone === ALL ? ALL : (suggested?.region ?? urlSearch.region ?? ALL);

  const patchSearch = (patch: Partial<LeaderboardSearch>, replace = false) =>
    navigate({
      search: (prev) => {
        const next = { ...prev, ...patch };
        for (const k of Object.keys(next) as (keyof LeaderboardSearch)[]) {
          if (!next[k]) delete next[k];
        }
        return next;
      },
      replace,
    });

  // Las regiones dependen de la zona: al cambiarla, la región elegida ya no aplica.
  const setZone = (v: string) =>
    patchSearch({ zone: v === ALL ? ALL_ZONES_PARAM : v, region: undefined });
  // Cambiar región o tienda fija en la URL la zona que se estaba mostrando.
  const shownZone = zone === ALL ? urlSearch.zone : zone;
  const setRegion = (v: string) =>
    patchSearch({ zone: shownZone, region: v === ALL ? undefined : v });
  const setStoreId = (v: string) =>
    patchSearch({
      zone: shownZone,
      region: region === ALL ? undefined : region,
      store: v === ALL ? undefined : v,
    });
  const setMonth = (v: string) => patchSearch({ month: v === ALL ? undefined : v });
  // Teclear no debe ensuciar el historial: replace en vez de push.
  const setSearch = (v: string) => patchSearch({ q: v || undefined }, true);
  const setPeriod = (v: Period) => patchSearch({ period: v === "monthly" ? undefined : v });
  // Restablecer = vista nacional sin búsqueda. Con sesión se guarda zone=all para
  // que la región sugerida no vuelva a aplicarse sola.
  const resetFilters = () =>
    patchSearch({
      zone: viewer ? ALL_ZONES_PARAM : undefined,
      region: undefined,
      store: undefined,
      month: undefined,
      q: undefined,
    });

  const optionsQuery = useQuery(leaderboardOptionsQuery());
  const stores = (optionsQuery.data?.stores ?? []) as Store[];
  const months = (optionsQuery.data?.months ?? []) as string[];

  const boardQuery = useQuery({
    ...leaderboardQuery({
      game_id: activeTcg?.id ?? null,
      zone: zone === ALL ? null : zone,
      region: region === ALL ? null : region,
      store_id: storeId === ALL ? null : storeId,
      month: month === ALL ? null : month,
    }),
    enabled: !!activeTcg && regionReady,
  });
  const monthly = (boardQuery.data?.monthly ?? []) as Row[];
  const semestral = (boardQuery.data?.semestral ?? []) as Row[];
  const monthLbl = boardQuery.data?.month_label ?? "";
  const semesterLbl = boardQuery.data?.semester_label ?? "";
  // isPending solo es true sin datos (ni cacheados ni previos): el skeleton
  // aparece únicamente en la primera carga real, no en cada cambio de filtro.
  const loading = boardQuery.isPending;

  useEffect(() => {
    if (optionsQuery.isError) toast.error("Error al cargar los filtros. Intenta de nuevo.");
  }, [optionsQuery.isError]);

  const zones = useMemo(() => {
    const set = new Set<string>();
    for (const s of stores) if (s.zone) set.add(s.zone);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es-MX"));
  }, [stores]);

  const regions = useMemo(() => regionsForZone(stores, zone), [stores, zone]);

  const visibleStores = useMemo(() => {
    return stores.filter(
      (s) => (zone === ALL || s.zone === zone) && (region === ALL || storeRegion(s) === region),
    );
  }, [stores, zone, region]);

  useEffect(() => {
    if (storeId !== ALL && stores.length > 0 && !visibleStores.some((s) => s.id === storeId)) {
      patchSearch({ store: undefined }, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleStores, storeId, stores.length]);

  const applySearch = (rows: Row[]) => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => r.geek_tag.toLowerCase().includes(q));
  };

  const filteredMonthly = useMemo(() => applySearch(monthly), [monthly, search]);
  const filteredSemestral = useMemo(() => applySearch(semestral), [semestral, search]);

  const selectedStore = stores.find((s) => s.id === storeId);

  // Filtros avanzados: abiertos solo si ya hay alguno aplicado; el conteo vive en el botón.
  const activeFilterCount =
    (zone !== ALL ? 1 : 0) +
    (region !== ALL ? 1 : 0) +
    (storeId !== ALL ? 1 : 0) +
    (month !== ALL ? 1 : 0);
  const [filtersOpen, setFiltersOpen] = useState(
    () =>
      !!(
        urlSearch.region ||
        urlSearch.store ||
        urlSearch.month ||
        (urlSearch.zone && urlSearch.zone !== ALL_ZONES_PARAM)
      ),
  );
  const canReset = activeFilterCount > 0 || !!search;

  // Un solo lugar dice qué alcance tiene la tabla (antes se repetía en 3).
  const scopeLabel = selectedStore
    ? `${selectedStore.name}${selectedStore.city ? ` — ${selectedStore.city}` : ""}`
    : region !== ALL
      ? `${zone} · ${region}`
      : zone !== ALL
        ? zone
        : "Todo el país";
  const shownRows = period === "semestral" ? filteredSemestral : filteredMonthly;
  const periodLabel = period === "semestral" ? semesterLbl : monthLbl;

  // Franja de apertura: el podio y las cifras siguen el periodo y los filtros de la tabla,
  // pero no la búsqueda (habla del circuito, no de lo que se está tecleando).
  const bandRows = period === "semestral" ? semestral : monthly;
  const allBandLeaders =
    (period === "semestral"
      ? boardQuery.data?.semestral_leaders
      : boardQuery.data?.monthly_leaders) ?? {};
  // Con perfil privado no se ven los decks de los demás (solo el propio).
  const bandLeaders = hidesOthersDecks
    ? Object.fromEntries(Object.entries(allBandLeaders).filter(([id]) => id === viewer?.id))
    : allBandLeaders;
  const bandStats = {
    players: bandRows.length,
    // La Tabla General no se filtra por tienda; la mensual sí.
    stores: period === "monthly" && selectedStore ? 1 : visibleStores.length,
    tournaments:
      (period === "semestral"
        ? boardQuery.data?.semestral_tournaments
        : boardQuery.data?.monthly_tournaments) ?? 0,
    tournamentsLabel: period === "semestral" ? "Torneos de la temporada" : "Torneos del mes",
  };

  return (
    <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 sm:px-6 xl:grid-cols-[160px_minmax(0,1fr)_160px] items-start">
      <aside className="hidden xl:block">
        {!isStaff && <AdVertical sponsor={activeSponsor} />}
      </aside>
      <main className="min-w-0 pb-20">
        <header className="mb-5 mt-6 sm:mt-8">
          <h1 className="text-3xl font-bold leading-tight text-foreground sm:text-4xl">
            Circuito Nacional
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground-secondary">
            <span>{[activeTcg?.name, periodLabel, scopeLabel].filter(Boolean).join(" · ")}</span>
            {suggested && (
              <button
                type="button"
                onClick={() => setZone(ALL)}
                className="cursor-pointer font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                Tu región · Ver nacional
              </button>
            )}
          </p>
        </header>

        <RankingBand
          rows={bandRows}
          leaders={bandLeaders}
          loading={loading || optionsQuery.isPending}
          periodLabel={periodLabel}
          scopeLabel={scopeLabel}
          showDelta={period === "monthly"}
          stats={bandStats}
          audience={isStaff ? "staff" : viewer ? "player" : "visitor"}
          audienceLoading={authLoading}
          viewerTag={myNexusTag}
        />

        <section aria-label="Filtros del ranking" className="mb-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <PeriodSegmentedControl period={period} onChange={setPeriod} />
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search
                size={14}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar Nexus Tag…"
                aria-label="Buscar jugador por Nexus Tag"
                className="min-h-11 w-full rounded-md border border-border bg-transparent py-2 pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-foreground-subtle focus:border-primary focus:ring-1 focus:ring-primary md:min-h-9"
              />
            </div>
            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-controls="leaderboard-filters"
              onClick={() => setFiltersOpen((o) => !o)}
              className={BTN_OUTLINE}
            >
              Filtros
              {activeFilterCount > 0 && (
                <span className="font-mono-stat text-primary">({activeFilterCount})</span>
              )}
              <ChevronDown
                size={14}
                aria-hidden="true"
                className={`transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`}
              />
            </button>
            {canReset && (
              <button
                type="button"
                onClick={resetFilters}
                className="min-h-11 cursor-pointer rounded-md px-2 text-sm font-medium text-foreground-secondary transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 md:min-h-9"
              >
                Restablecer filtros
              </button>
            )}
          </div>
          {filtersOpen && (
            <div id="leaderboard-filters" className="flex flex-wrap items-center gap-2">
              <PillSelect
                label="Zona"
                value={zone}
                onChange={setZone}
                options={[
                  { value: ALL, label: "Todas" },
                  ...zones.map((z) => ({ value: z, label: z })),
                ]}
              />
              {zone !== ALL && (
                <PillSelect
                  label="Región"
                  value={region}
                  onChange={setRegion}
                  options={[
                    { value: ALL, label: "Todas" },
                    ...regions.map((r) => ({ value: r, label: r })),
                  ]}
                />
              )}
              <PillSelect
                label="Tienda"
                value={storeId}
                onChange={setStoreId}
                options={[
                  { value: ALL, label: "Todas las tiendas" },
                  ...visibleStores.map((s) => ({
                    value: s.id,
                    label: `${s.name}${s.city ? ` — ${s.city}` : ""}`,
                  })),
                ]}
              />
              <PillSelect
                label="Mes"
                value={month}
                onChange={setMonth}
                options={[
                  { value: ALL, label: "Más reciente" },
                  ...months.map((m) => ({ value: m, label: monthLabel(m) })),
                ]}
              />
            </div>
          )}
        </section>

        <LeaderboardTable
          title={period === "semestral" ? "Tabla General" : "Tabla Mensual"}
          note={
            period === "semestral"
              ? "Puntos acumulados de la temporada · no se filtra por tienda"
              : "Puntos de los torneos del mes"
          }
          rows={shownRows}
          loading={loading}
          fetching={boardQuery.isFetching && !loading}
          error={boardQuery.isError}
          onRetry={() => boardQuery.refetch()}
          myNexusTag={myNexusTag}
          search={search}
          onClearSearch={() => setSearch("")}
          onReset={resetFilters}
          canReset={canReset}
        />

        {!isStaff && (
          <div className="mt-6 space-y-4">
            <AdCarousel sponsors={allSponsors.filter((s) => s.is_active)} />
            <div className="lg:hidden">
              <AdHorizontal sponsor={activeSponsor} />
            </div>
          </div>
        )}
      </main>
      <aside className="hidden xl:block">
        {!isStaff && <AdVertical sponsor={activeSponsor} />}
      </aside>
    </div>
  );
}

function RankDelta({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-xs font-medium leading-none text-foreground-subtle">Nuevo</span>;
  }
  if (delta === 0) {
    return (
      <span className="text-xs leading-none text-foreground-subtle">
        —<span className="sr-only">Sin cambio de lugar</span>
      </span>
    );
  }
  const up = delta > 0;
  const n = Math.abs(delta);
  const Arrow = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono-stat text-xs font-medium leading-none ${
        up ? "text-success" : "text-danger"
      }`}
    >
      <Arrow size={12} aria-hidden="true" className="shrink-0" />
      {n}
      <span className="sr-only">
        {up ? "Subió" : "Bajó"} {n} {n === 1 ? "lugar" : "lugares"}
      </span>
    </span>
  );
}

function RankCell({
  rank,
  delta,
  podium,
}: {
  rank: number;
  delta: number | null;
  podium: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-1 leading-none">
      <span
        className={`font-mono-stat text-base font-bold ${
          podium ? PODIUM_TEXT[rank - 1] : "text-foreground-secondary"
        }`}
      >
        {rank}
      </span>
      <RankDelta delta={delta} />
    </div>
  );
}

function MeBadge() {
  return (
    <span className="flex-shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-xs font-semibold text-primary">
      Tú
    </span>
  );
}

function ColumnHelp() {
  return (
    <details className="border-b border-border px-4 text-xs text-foreground-secondary">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 md:min-h-9">
        Cómo leer la tabla
      </summary>
      <dl className="grid gap-x-8 gap-y-3 pb-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-foreground">Puntos</dt>
          <dd>Los que sumaste en los torneos del periodo.</dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">Torneos y ganados</dt>
          <dd>Torneos que jugaste y torneos que ganaste en el periodo.</dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">OMW %</dt>
          <dd>
            Porcentaje de victorias de tus rivales (Opponent Match Win). Si dos jugadores empatan en
            puntos, va arriba el de mayor OMW.
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">Flecha junto al lugar</dt>
          <dd>
            Lugares que subiste o bajaste frente al mes anterior. “Nuevo” = no jugaste el mes
            anterior.
          </dd>
        </div>
      </dl>
    </details>
  );
}

function LeaderboardTable({
  title,
  note,
  rows,
  loading,
  fetching,
  error,
  onRetry,
  myNexusTag,
  search,
  onClearSearch,
  onReset,
  canReset,
}: {
  title: string;
  note?: string | null;
  rows: Row[];
  loading: boolean;
  fetching: boolean;
  error: boolean;
  onRetry: () => void;
  myNexusTag?: string | null;
  search?: string;
  onClearSearch?: () => void;
  onReset?: () => void;
  canReset?: boolean;
}) {
  const omwFor = (r: Row) => r.omw_percentage ?? 0;
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    // Filas de dos líneas en móvil (~64px) y de una en escritorio (~56px).
    estimateSize: () => (typeof window !== "undefined" && window.innerWidth < 768 ? 64 : 56),
    overscan: 10,
  });

  const myRowIndex = myNexusTag ? rows.findIndex((r) => r.geek_tag === myNexusTag) : -1;
  const scrollToMe = () => {
    if (myRowIndex < 0) return;
    virtualizer.scrollToIndex(myRowIndex, { align: "center", behavior: "smooth" });

    // Flash highlight después del scroll
    setTimeout(() => {
      const el = scrollRef.current?.querySelector(`[data-index="${myRowIndex}"]`);
      if (el) {
        el.classList.add("ring-2", "ring-primary", "ring-inset");
        setTimeout(() => el.classList.remove("ring-2", "ring-primary", "ring-inset"), 1200);
      }
    }, 500);
  };

  return (
    <section className="@container flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {note && <p className="mt-0.5 text-xs text-foreground-subtle">{note}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span role="status" aria-live="polite" className="text-xs text-foreground-subtle">
            {fetching ? "Actualizando…" : ""}
          </span>
          {myRowIndex >= 0 && (
            <button
              type="button"
              onClick={scrollToMe}
              className={`${BTN_OUTLINE} text-primary hover:text-primary`}
            >
              Mi posición
            </button>
          )}
        </div>
      </header>

      <ColumnHelp />

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 text-sm text-foreground"
        >
          <span>
            No pudimos cargar el ranking.
            {rows.length > 0 ? " Esta tabla puede estar desactualizada." : ""}
          </span>
          <button type="button" onClick={onRetry} className={BTN_OUTLINE}>
            Reintentar
          </button>
        </div>
      )}

      {/* Header fijo */}
      <div
        className={`hidden @3xl:grid ${GRID_DESKTOP} gap-3 overflow-hidden border-b border-border bg-background/60 px-4 py-2 text-xs font-semibold text-foreground-subtle [scrollbar-gutter:stable]`}
      >
        <div>Lugar</div>
        <div>Jugador</div>
        <div>Ciudad</div>
        <div className="text-right">Puntos</div>
        <div className="text-right">Torneos</div>
        <div className="text-right">Ganados</div>
        <div className="text-right">OMW %</div>
      </div>

      <div
        className={`grid @3xl:hidden ${GRID_MOBILE} gap-3 overflow-hidden border-b border-border bg-background/60 px-4 py-2 text-xs font-semibold text-foreground-subtle [scrollbar-gutter:stable]`}
      >
        <div>Lugar</div>
        <div>Jugador</div>
        <div className="text-right">Puntos</div>
      </div>

      {/* Contenedor virtualizado */}
      <div
        ref={scrollRef}
        className="max-h-[min(640px,70vh)] overflow-y-auto [scrollbar-gutter:stable]"
      >
        {loading ? (
          <div aria-busy="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <Fragment key={i}>
                <div
                  className={`hidden @3xl:grid ${GRID_DESKTOP} items-center gap-3 border-b border-border px-4 py-4`}
                >
                  <div className="h-3 w-6 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-3 w-32 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-3 w-16 animate-pulse rounded bg-white/[0.06]" />
                  <div className="ml-auto h-3 w-12 animate-pulse rounded bg-white/[0.06]" />
                  <div className="ml-auto h-3 w-6 animate-pulse rounded bg-white/[0.06]" />
                  <div className="ml-auto h-3 w-6 animate-pulse rounded bg-white/[0.06]" />
                  <div className="ml-auto h-3 w-10 animate-pulse rounded bg-white/[0.06]" />
                </div>
                <div
                  className={`grid @3xl:hidden ${GRID_MOBILE} items-center gap-3 border-b border-border px-4 py-3.5`}
                >
                  <div className="h-3 w-6 animate-pulse rounded bg-white/[0.06]" />
                  <div className="space-y-2">
                    <div className="h-3 w-28 animate-pulse rounded bg-white/[0.06]" />
                    <div className="h-3 w-40 animate-pulse rounded bg-white/[0.06]" />
                  </div>
                  <div className="ml-auto h-3 w-10 animate-pulse rounded bg-white/[0.06]" />
                </div>
              </Fragment>
            ))}
          </div>
        ) : rows.length === 0 && !error ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-foreground">
              {search
                ? `No encontramos "${search}" en este ranking`
                : "Sin resultados para estos filtros"}
            </p>
            <p className="mt-1 text-xs text-foreground-subtle">
              Prueba cambiando la zona, la región, la tienda o el mes
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {search && onClearSearch && (
                <button type="button" onClick={onClearSearch} className={BTN_OUTLINE}>
                  Limpiar búsqueda
                </button>
              )}
              {canReset && onReset && (
                <button type="button" onClick={onReset} className={BTN_OUTLINE}>
                  Restablecer filtros
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px` }} className="relative w-full">
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const r = rows[virtualRow.index];
              const rank = r.rank_position;
              const podium = rank > 0 && rank <= 3;
              const isMe = !!myNexusTag && r.geek_tag === myNexusTag;
              const city = r.city && r.city !== "—" ? r.city : null;
              return (
                <Link
                  key={r.player_id}
                  to="/players/$playerTag"
                  params={{ playerTag: r.geek_tag }}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement as any}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className={`block border-b border-border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${
                    isMe ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-white/5"
                  }`}
                >
                  {/* Desktop */}
                  <div className={`hidden @3xl:grid ${GRID_DESKTOP} items-center gap-3 px-4 py-3`}>
                    <RankCell rank={rank} delta={r.rank_delta} podium={podium} />
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`truncate font-medium ${isMe ? "text-primary" : "text-foreground"}`}
                      >
                        {r.geek_tag}
                      </span>
                      {isMe && <MeBadge />}
                    </div>
                    <span className="truncate text-sm text-foreground-secondary">
                      {city ?? "—"}
                    </span>
                    <span className="text-right font-mono-stat text-sm font-semibold text-foreground">
                      {r.points.toLocaleString("es-MX")}
                    </span>
                    <span className="text-right font-mono-stat text-sm text-foreground-secondary">
                      {r.tournaments_played}
                    </span>
                    <span className="text-right font-mono-stat text-sm text-foreground-secondary">
                      {r.tournaments_won}
                    </span>
                    <span className="text-right font-mono-stat text-sm text-foreground-secondary">
                      {omwFor(r)}%
                    </span>
                  </div>
                  {/* Mobile: dos líneas, para comparar sin abrir el perfil */}
                  <div className={`grid @3xl:hidden ${GRID_MOBILE} items-center gap-3 px-4 py-3`}>
                    <RankCell rank={rank} delta={r.rank_delta} podium={podium} />
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`truncate font-medium ${isMe ? "text-primary" : "text-foreground"}`}
                        >
                          {r.geek_tag}
                        </span>
                        {isMe && <MeBadge />}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-foreground-secondary">
                        {[
                          city,
                          `${r.tournaments_played} ${r.tournaments_played === 1 ? "torneo" : "torneos"}`,
                          `${r.tournaments_won} ${r.tournaments_won === 1 ? "ganado" : "ganados"}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <span className="text-right font-mono-stat text-base font-semibold text-foreground">
                      {r.points.toLocaleString("es-MX")}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

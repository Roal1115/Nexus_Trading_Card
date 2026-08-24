import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { HelpCircle, Medal, Search, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useVirtualizer } from "@tanstack/react-virtual";
import { LeaderboardRowSkeleton } from "@/components/ui/skeleton-loader";
import { useNexusRole } from "@/hooks/use-nexus-role";

import { useQuery } from "@tanstack/react-query";
import { leaderboardOptionsQuery, leaderboardQuery } from "@/lib/leaderboard-queries";
import { listActiveSponsors, getActiveBanner } from "@/lib/nexus-ads.functions";
import { AdVertical } from "@/components/ads/AdVertical";
import { AdHorizontal } from "@/components/ads/AdHorizontal";
import { AdCarousel } from "@/components/ads/AdCarousel";
import { ArrowUp, ArrowDown, ArrowRight } from "lucide-react";
import { PillSelect } from "@/components/ui/pill-select";

type Period = "monthly" | "semestral";

type LeaderboardSearch = {
  tcg?: string;
  city?: string;
  store?: string;
  month?: string;
  q?: string;
  period?: Period;
};

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): LeaderboardSearch => ({
    tcg: typeof s.tcg === "string" && s.tcg ? s.tcg : undefined,
    city: typeof s.city === "string" && s.city ? s.city : undefined,
    store: typeof s.store === "string" && s.store ? s.store : undefined,
    month: typeof s.month === "string" && /^\d{4}-\d{2}$/.test(s.month) ? s.month : undefined,
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    period: s.period === "semestral" ? "semestral" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Trading Card Nexus" },
      {
        name: "description",
        content:
          "Únete a Trading Card Nexus, la plataforma definitiva para jugadores competitivos de TCG.",
      },
    ],
  }),
  component: LeaderboardPage,
});

type Game = { id: string; slug: string; name: string };
type Store = { id: string; name: string; city: string | null };
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

function HeroBackground() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="heroGlow1" cx="70%" cy="10%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="heroGlow2" cx="20%" cy="80%" r="40%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </radialGradient>
        <filter id="cardBlur">
          <feGaussianBlur stdDeviation="0.8" />
        </filter>
      </defs>

      {/* Radial glows */}
      <rect width="100%" height="100%" fill="url(#heroGlow1)" />
      <rect width="100%" height="100%" fill="url(#heroGlow2)" />

      {/* Constellation lines */}
      <g stroke="var(--primary)" strokeOpacity="0.12" strokeWidth="0.8">
        <line x1="10%" y1="20%" x2="30%" y2="45%" />
        <line x1="30%" y1="45%" x2="55%" y2="30%" />
        <line x1="55%" y1="30%" x2="75%" y2="55%" />
        <line x1="75%" y1="55%" x2="90%" y2="35%" />
        <line x1="20%" y1="70%" x2="40%" y2="55%" />
        <line x1="40%" y1="55%" x2="60%" y2="75%" />
        <line x1="60%" y1="75%" x2="80%" y2="60%" />
        <line x1="15%" y1="40%" x2="25%" y2="65%" />
        <line x1="65%" y1="15%" x2="80%" y2="35%" />
      </g>

      {/* Constellation dots */}
      <g fill="var(--primary)" fillOpacity="0.35">
        <circle cx="10%" cy="20%" r="1.5" />
        <circle cx="30%" cy="45%" r="2" />
        <circle cx="55%" cy="30%" r="1.5" />
        <circle cx="75%" cy="55%" r="2.5" />
        <circle cx="90%" cy="35%" r="1.5" />
        <circle cx="20%" cy="70%" r="1.5" />
        <circle cx="40%" cy="55%" r="1" />
        <circle cx="60%" cy="75%" r="2" />
        <circle cx="80%" cy="60%" r="1.5" />
        <circle cx="15%" cy="40%" r="1" />
        <circle cx="25%" cy="65%" r="1.5" />
        <circle cx="65%" cy="15%" r="2" />
      </g>

      {/* Floating card silhouettes */}
      <g filter="url(#cardBlur)" opacity="0.18">
        <rect
          x="78%"
          y="8%"
          width="8%"
          height="11%"
          rx="4"
          ry="4"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="1.2"
          transform="rotate(-12, 82, 13)"
        />
        <rect
          x="83%"
          y="5%"
          width="8%"
          height="11%"
          rx="4"
          ry="4"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.2"
          transform="rotate(5, 87, 10)"
        />
        <rect
          x="74%"
          y="14%"
          width="8%"
          height="11%"
          rx="4"
          ry="4"
          fill="none"
          stroke="#5F8CFF"
          strokeWidth="1"
          transform="rotate(-20, 78, 19)"
        />
        <line
          x1="79.5%"
          y1="10%"
          x2="84.5%"
          y2="10%"
          stroke="var(--primary)"
          strokeWidth="0.6"
          strokeOpacity="0.6"
        />
        <line
          x1="79.5%"
          y1="12%"
          x2="82%"
          y2="12%"
          stroke="var(--primary)"
          strokeWidth="0.6"
          strokeOpacity="0.4"
        />
      </g>

      {/* Scan line */}
      <rect x="0" y="45%" width="100%" height="1px" fill="url(#heroGlow1)" opacity="0.08" />
    </svg>
  );
}

function PeriodSegmentedControl({
  period,
  onChange,
}: {
  period: Period;
  onChange: (p: Period) => void;
}) {
  const options: Array<{ value: Period; label: string }> = [
    { value: "monthly", label: "Mensual" },
    { value: "semestral", label: "Semestral" },
  ];
  return (
    <div
      role="tablist"
      aria-label="Periodo del ranking"
      className="inline-flex gap-1 rounded-md border border-white/10 bg-white/5 p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={period === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
            period === o.value
              ? "bg-primary/15 text-primary"
              : "text-gray-400 hover:text-gray-200"
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
  const { player: viewer, role } = useNexusRole();
  const myGeekTag = viewer?.geek_tag ?? null;

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
  // sobrevive atrás/adelante y refresh). Sin valores en la URL: TCG = Todos.
  const urlSearch = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const tcg = urlSearch.tcg ?? ALL;
  const city = urlSearch.city ?? ALL;
  const storeId = urlSearch.store ?? ALL;
  const month = urlSearch.month ?? ALL;
  const search = urlSearch.q ?? "";
  const period: Period = urlSearch.period ?? "monthly";

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

  const handleTcgChange = (v: string) => patchSearch({ tcg: v === ALL ? undefined : v });
  const setCity = (v: string) => patchSearch({ city: v === ALL ? undefined : v });
  const setStoreId = (v: string) => patchSearch({ store: v === ALL ? undefined : v });
  const setMonth = (v: string) => patchSearch({ month: v === ALL ? undefined : v });
  // Teclear no debe ensuciar el historial: replace en vez de push.
  const setSearch = (v: string) => patchSearch({ q: v || undefined }, true);
  const setPeriod = (v: Period) => patchSearch({ period: v === "monthly" ? undefined : v });

  const optionsQuery = useQuery(leaderboardOptionsQuery());
  const games = (optionsQuery.data?.games ?? []) as Game[];
  const stores = (optionsQuery.data?.stores ?? []) as Store[];
  const months = (optionsQuery.data?.months ?? []) as string[];

  const boardQuery = useQuery(
    leaderboardQuery({
      game_id: tcg === ALL ? null : tcg,
      city: city === ALL ? null : city,
      store_id: storeId === ALL ? null : storeId,
      month: month === ALL ? null : month,
    }),
  );
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
  useEffect(() => {
    if (boardQuery.isError) toast.error("Error al cargar el ranking. Intenta de nuevo.");
  }, [boardQuery.isError]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const s of stores) if (s.city) set.add(s.city);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es-MX"));
  }, [stores]);

  const visibleStores = useMemo(() => {
    if (city === ALL) return stores;
    return stores.filter((s) => s.city === city);
  }, [stores, city]);

  useEffect(() => {
    if (
      storeId !== ALL &&
      stores.length > 0 &&
      !visibleStores.some((s) => s.id === storeId)
    ) {
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

  return (
    <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-4 sm:px-6 xl:grid-cols-[160px_minmax(0,1fr)_160px] items-start">
      <aside className="hidden xl:block">
        {!isStaff && <AdVertical sponsor={activeSponsor} />}
      </aside>
      <main className="min-w-0 pb-20">
        <section className="relative my-8 overflow-hidden rounded-2xl border-border bg-card p-8 sm:p-12">
          <HeroBackground />
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            Temporada III · Patrocinado por Bandai · Wizards · TPCI
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight text-white sm:text-6xl bg-gradient-to-r from-primary via-[#5F8CFF] to-accent bg-clip-text text-transparent">
            Circuito <span className="text-primary">Nacional</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm text-gray-400 sm:text-base">
            El sistema oficial de ranking para TCG competitivo. Escala la tabla. Gana tu boleto al
            Mundial.
          </p>
        </section>

        {!isStaff && <AdCarousel sponsors={allSponsors.filter((s) => s.is_active)} />}

        <div
          className="z-30 mb-6 rounded-xl px-4 py-3"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 32px rgba(0,0,0,0.3)",
          }}
        >
          {" "}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap w-full items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs transition hover:border-white/20 cursor-pointer ... min-w-[180px]">
              <PillSelect
                label="TCG"
                value={tcg}
                onChange={handleTcgChange}
                options={[
                  { value: ALL, label: "Todos" },
                  ...games.map((g) => ({ value: g.id, label: g.name })),
                ]}
              />

              <PillSelect
                label="Ciudad"
                value={city}
                onChange={(v) => setCity(v)}
                options={[
                  { value: ALL, label: "Todas" },
                  ...cities.map((c) => ({ value: c, label: c })),
                ]}
              />
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
            <div className="relative w-full">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar Geek Tag…"
                className="w-full rounded-md border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </div>

        {selectedStore && (
          <div className="mb-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-gray-300">
            Mostrando resultados de:{" "}
            <strong className="text-white">
              {selectedStore.name}
              {selectedStore.city ? ` — ${selectedStore.city}` : ""}
            </strong>
          </div>
        )}

        <div className="mb-4">
          <PeriodSegmentedControl period={period} onChange={setPeriod} />
        </div>

        <div className="lg:hidden">{!isStaff && <AdHorizontal sponsor={activeSponsor} />}</div>

        <LeaderboardTable
          title={period === "semestral" ? "General Semestral" : "Ranking Mensual"}
          badge={period === "semestral" ? semesterLbl : monthLbl.toUpperCase()}
          subtitle={
            period === "semestral"
              ? "Ranking general · no filtrado por tienda"
              : selectedStore
                ? `Mostrando: ${selectedStore.name}${selectedStore.city ? ` — ${selectedStore.city}` : ""}`
                : null
          }
          rows={period === "semestral" ? filteredSemestral : filteredMonthly}
          loading={loading}
          myGeekTag={myGeekTag}
          search={search}
          onClearSearch={() => setSearch("")}
        />
      </main>
      <aside className="hidden xl:block">
        {!isStaff && <AdVertical sponsor={activeSponsor} />}
      </aside>
    </div>
  );
}

function RankDelta({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-[10px] font-semibold text-gray-400 leading-none">NEW</span>;
  }
  if (delta === 0) {
    return <span className="text-[10px] font-semibold text-gray-400 leading-none">—</span>;
  }
  if (delta > 0) {
    return (
      <div className="flex items-center gap-0.5 text-emerald-400">
        <ArrowUp size={10} className="shrink-0" />
        <span className="text-xs font-medium leading-none">{delta}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-0.5 text-red-400">
      <ArrowDown size={10} className="shrink-0" />
      <span className="text-xs font-medium leading-none">{Math.abs(delta)}</span>
    </div>
  );
}

function LeaderboardTable({
  title,
  badge,
  subtitle,
  rows,
  loading,
  myGeekTag,
  search,
  onClearSearch,
}: {
  title: string;
  badge: string;
  subtitle?: string | null;
  rows: Row[];
  loading: boolean;
  myGeekTag?: string | null;
  search?: string;
  onClearSearch?: () => void;
}) {
  const omwFor = (r: Row) => r.omw_percentage ?? 0;
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44,
    overscan: 10,
  });

  const myRowIndex = myGeekTag ? rows.findIndex((r) => r.geek_tag === myGeekTag) : -1;
  const scrollToMe = () => {
    if (myRowIndex < 0 || !scrollRef.current) return;

    // Calcular posición estimada de la fila
    const estimatedTop = myRowIndex * 44; // estimateSize es 44px
    const containerHeight = scrollRef.current.clientHeight;
    const targetScroll = estimatedTop - containerHeight / 2 + 22;

    scrollRef.current.scrollTo({
      top: Math.max(0, targetScroll),
      behavior: "smooth",
    });

    // Flash highlight después del scroll
    setTimeout(() => {
      const el = scrollRef.current?.querySelector(`[data-index="${myRowIndex}"]`);
      if (el) {
        el.classList.add("ring-2", "ring-primary", "ring-inset");
        setTimeout(() => el.classList.remove("ring-2", "ring-primary", "ring-inset"), 1200);
      }
    }, 500);
  };

  // Grid columns: # | Geek Tag | Ciudad | Pts | Torneos | Victorias | OMW%
  const gridCols = "grid-cols-[40px_1fr_64px_56px_36px_36px_52px]";
  const gridColsMobile = "grid-cols-[40px_1fr_68px]";

  return (
    <section className="glass overflow-hidden rounded-2xl h-full flex flex-col">
      <header className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Trophy className="text-primary" size={18} />
              <h2 className="text-lg font-semibold text-white">{title}</h2>
            </div>
            <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              {badge || "—"}
            </span>
            {myRowIndex >= 0 && (
              <button
                onClick={scrollToMe}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 transition hover:border-primary/30 hover:text-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                → Mi posición
              </button>
            )}
          </div>
        </div>
        {subtitle && <p className="mt-2 text-xs text-gray-400">{subtitle}</p>}
      </header>

      {/* Header fijo */}
      <div
        className={`hidden md:grid ${gridCols} gap-3.5 bg-black/80 px-3 py-2 text-[10px] uppercase tracking-wider text-gray-400`}
      >
        <div>#</div>
        <div>Tag</div>
        <div>Ciudad</div>
        <div className="text-right">Pts</div>
        <div className="text-right" title="Torneos jugados">
          Trn
        </div>
        <div className="text-right" title="Victorias">
          W
        </div>
        <div className="text-right" title="Opponent Match Win %">
          OMW%
        </div>
      </div>

      <div
        className={`grid md:hidden ${gridColsMobile} bg-black/80 px-3 py-2 text-xs uppercase tracking-wider text-gray-400`}
      >
        <div>#</div>
        <div>Geek Tag</div>
        <div className="text-right">Pts</div>
      </div>

      {/* Contenedor virtualizado */}
      <div ref={scrollRef} className="max-h-[640px] overflow-y-auto">
        {loading ? (
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <Fragment key={i}>
                <div
                  className={`hidden md:grid ${gridCols} border-b border-white/5 px-3 py-2.5 gap-2 items-center`}
                >
                  <div className="h-3 w-6 rounded bg-white/[0.06] animate-pulse" />
                  <div className="h-3 w-32 rounded bg-white/[0.06] animate-pulse" />
                  <div className="h-3 w-16 rounded bg-white/[0.06] animate-pulse" />
                  <div className="h-3 w-12 rounded bg-white/[0.06] animate-pulse ml-auto" />
                  <div className="h-3 w-6 rounded bg-white/[0.06] animate-pulse ml-auto" />
                  <div className="h-3 w-6 rounded bg-white/[0.06] animate-pulse ml-auto" />
                  <div className="h-3 w-10 rounded bg-white/[0.06] animate-pulse ml-auto" />
                </div>
                <div
                  className={`grid md:hidden ${gridColsMobile} border-b border-white/5 px-3 py-2.5 gap-2 items-center`}
                >
                  <div className="h-3 w-6 rounded bg-white/[0.06] animate-pulse" />
                  <div className="h-3 w-28 rounded bg-white/[0.06] animate-pulse" />
                  <div className="h-3 w-10 rounded bg-white/[0.06] animate-pulse ml-auto" />
                </div>
              </Fragment>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-3 py-12 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <Search size={16} className="text-gray-500" />
            </div>
            <p className="text-sm text-gray-400">
              {search
                ? `No encontramos "${search}" en este ranking`
                : "Sin resultados para estos filtros"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Prueba cambiando el TCG, ciudad o mes seleccionado
            </p>
            {search && onClearSearch && (
              <button
                type="button" // Always specify the type for buttons to prevent accidental form submission
                onClick={onClearSearch}
                className="mt-4 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                Limpiar búsqueda
              </button>
            )}
          </div>
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px` }} className="relative w-full">
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const r = rows[virtualRow.index];
              const rank = r.rank_position;
              const podium = rank > 0 && rank <= 3;
              const isMe = !!myGeekTag && r.geek_tag === myGeekTag;
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
                  className={`block border-b border-white/5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${
                    isMe
                      ? "bg-primary/15 hover:bg-primary/20"
                      : podium
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-white/5"
                  }`}
                >
                  {/* Desktop */}
                  <div className={`hidden md:grid ${gridCols} px-3 py-2.5 items-center gap-2`}>
                    <div className="flex flex-col items-start leading-none">
                      <span
                        className={`font-mono text-xs ${podium ? "font-bold text-primary" : "text-gray-400"}`}
                      >
                        {String(rank).padStart(2, "0")}
                      </span>
                      <RankDelta delta={r.rank_delta} />
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      {rank === 1 && <Medal className="text-amber-300 flex-shrink-0" size={14} />}
                      <span
                        className={`font-medium truncate ${isMe ? "text-primary" : "text-white"}`}
                      >
                        {r.geek_tag}
                      </span>
                      {isMe && (
                        <span className="flex-shrink-0 rounded bg-primary/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                          Tú
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 truncate">{r.city}</span>
                    <span className="text-right font-mono font-semibold text-white text-sm">
                      {r.points.toLocaleString()}
                    </span>
                    <span className="text-right font-mono text-xs text-gray-400">
                      {r.tournaments_played}
                    </span>
                    <span className="text-right font-mono text-xs text-gray-400">
                      {r.tournaments_won}
                    </span>
                    <span className="text-right font-mono text-xs text-gray-400">{omwFor(r)}%</span>
                  </div>
                  {/* Mobile */}
                  <div
                    className={`grid md:hidden ${gridColsMobile} px-3 py-2.5 items-center gap-2`}
                  >
                    <div className="flex flex-col items-start leading-none">
                      <span
                        className={`font-mono text-xs ${podium ? "font-bold text-primary" : "text-gray-400"}`}
                      >
                        {String(rank).padStart(2, "0")}
                      </span>
                      <RankDelta delta={r.rank_delta} />
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      {rank === 1 && <Medal className="text-amber-300 flex-shrink-0" size={14} />}
                      <span
                        className={`font-medium truncate ${isMe ? "text-primary" : "text-white"}`}
                      >
                        {r.geek_tag}
                      </span>
                      {isMe && (
                        <span className="flex-shrink-0 rounded bg-primary/30 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                          Tú
                        </span>
                      )}
                    </div>
                    <span className="text-right font-mono font-semibold text-white text-sm">
                      {r.points.toLocaleString()}
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

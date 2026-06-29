import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, HelpCircle, Medal, Search, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useVirtualizer } from "@tanstack/react-virtual";
import { LeaderboardRowSkeleton } from "@/components/ui/skeleton-loader";
import { useGeekarenaRole } from "@/hooks/use-geekarena-role";

import { getLeaderboard, getLeaderboardOptions } from "@/lib/geekarena-leaderboard.functions";
import {
  getActiveSponsor,
  listActiveSponsors,
  registerAdView,
} from "@/lib/geekarena-ads.functions";
import { AdVertical } from "@/components/ads/AdVertical";
import { AdHorizontal } from "@/components/ads/AdHorizontal";
import { AdCarousel } from "@/components/ads/AdCarousel";
import ReactDOM from "react-dom";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ranking del Circuito Nacional — Geek Arena" },
      {
        name: "description",
        content: "Rankings competitivos en vivo de los principales TCG en México.",
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

function LeaderboardPage() {
  const fetchOptions = useServerFn(getLeaderboardOptions);
  const fetchLeaderboard = useServerFn(getLeaderboard);
  const fetchActiveSponsor = useServerFn(getActiveSponsor);
  const fetchActiveSponsors = useServerFn(listActiveSponsors);
  const registerView = useServerFn(registerAdView);
  const { player: viewer } = useGeekarenaRole();
  const myGeekTag = viewer?.geek_tag ?? null;

  const [sponsor, setSponsor] = useState<any>(null);
  const [allSponsors, setAllSponsors] = useState<any[]>([]);

  useEffect(() => {
    registerView()
      .then(setSponsor)
      .catch(() => {
        fetchActiveSponsor()
          .then(setSponsor)
          .catch(() => {});
      });
    fetchActiveSponsors()
      .then(setAllSponsors)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [games, setGames] = useState<Game[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [months, setMonths] = useState<string[]>([]);

  const [tcg, setTcg] = useState<string>(() => {
    if (typeof window === "undefined") return ALL;
    return window.localStorage.getItem("ga_filter_tcg") ?? ALL;
  });
  const handleTcgChange = (v: string) => {
    setTcg(v);
    if (typeof window !== "undefined") {
      if (v === ALL) window.localStorage.removeItem("ga_filter_tcg");
      else window.localStorage.setItem("ga_filter_tcg", v);
    }
  };
  const [city, setCity] = useState<string>(ALL);
  const [storeId, setStoreId] = useState<string>(ALL);
  const [month, setMonth] = useState<string>(ALL);
  const [search, setSearch] = useState("");

  const [monthly, setMonthly] = useState<Row[]>([]);
  const [semestral, setSemestral] = useState<Row[]>([]);
  const [monthLbl, setMonthLbl] = useState<string>("");
  const [semesterLbl, setSemesterLbl] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const opts = await fetchOptions();
        if (!mounted) return;
        setGames(opts.games as Game[]);
        setStores(opts.stores as Store[]);
        setMonths(opts.months as string[]);
        if (opts.months.length > 0) setMonth(opts.months[0]);
      } catch (e) {
        toast.error("Error al cargar los filtros. Intenta de nuevo.");
        console.error(e);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchLeaderboard({
      data: {
        game_id: tcg === ALL ? null : tcg,
        city: city === ALL ? null : city,
        store_id: storeId === ALL ? null : storeId,
        month: month === ALL ? null : month,
      },
    })
      .then((res) => {
        if (!mounted) return;
        setMonthly(res.monthly as Row[]);
        setSemestral(res.semestral as Row[]);
        setMonthLbl(res.month_label);
        setSemesterLbl(res.semester_label);
      })
      .catch((e) => {
        toast.error("Error al cargar el ranking. Intenta de nuevo.");
        console.error(e);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tcg, city, storeId, month]);

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
    if (storeId !== ALL && !visibleStores.some((s) => s.id === storeId)) {
      setStoreId(ALL);
    }
  }, [visibleStores, storeId]);

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
        <AdVertical sponsor={sponsor} />
      </aside>
      <main className="min-w-0 pb-20">
        <section className="relative my-8 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-primary/20 via-black/40 to-black/20 p-8 sm:p-12">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
            Temporada III · Patrocinado por Bandai · Wizards · TPCI
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight text-white sm:text-6xl">
            Circuito <span className="text-primary">Nacional</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm text-gray-400 sm:text-base">
            El sistema oficial de ranking para TCG competitivo. Escala la tabla. Gana tu boleto al
            Mundial.
          </p>
        </section>

        <AdCarousel sponsors={allSponsors} />

        <div
          className="sm:sticky sm:top-16 z-30 mb-6 rounded-xl px-4 py-3"
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
            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect
                label="TCG"
                value={tcg}
                onChange={handleTcgChange}
                options={[
                  { value: ALL, label: "Todos" },
                  ...games.map((g) => ({ value: g.id, label: g.name })),
                ]}
              />

              <FilterSelect
                label="Ciudad"
                value={city}
                onChange={(v) => setCity(v)}
                options={[
                  { value: ALL, label: "Todas" },
                  ...cities.map((c) => ({ value: c, label: c })),
                ]}
              />
              <FilterSelect
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
              <FilterSelect
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
          <div className="mb-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary-foreground">
            Mostrando resultados de:{" "}
            <strong className="text-white">
              {selectedStore.name}
              {selectedStore.city ? ` — ${selectedStore.city}` : ""}
            </strong>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <LeaderboardTable
            title="Ranking Mensual"
            badge={monthLbl.toUpperCase()}
            subtitle={
              selectedStore
                ? `Mostrando: ${selectedStore.name}${selectedStore.city ? ` — ${selectedStore.city}` : ""}`
                : null
            }
            rows={filteredMonthly}
            loading={loading}
            myGeekTag={myGeekTag}
            search={search}
            onClearSearch={() => setSearch("")}
          />
          <div className="xl:hidden lg:hidden">
            <AdHorizontal sponsor={sponsor} />
          </div>
          <LeaderboardTable
            title="General Semestral"
            badge={semesterLbl}
            subtitle="Ranking general · no filtrado por tienda"
            rows={filteredSemestral}
            loading={loading}
            myGeekTag={myGeekTag}
            search={search}
            onClearSearch={() => setSearch("")}
          />
        </div>
      </main>
      <aside className="hidden xl:block">
        <AdVertical sponsor={sponsor} />
      </aside>
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
    if (myRowIndex >= 0) {
      virtualizer.scrollToIndex(myRowIndex, { align: "center" });
    }
  };

  // Grid columns: # | Geek Tag | Ciudad | Pts | Torneos | Victorias | OMW%
  const gridCols = "grid-cols-[32px_1fr_64px_56px_36px_36px_52px]";
  const gridColsMobile = "grid-cols-[36px_1fr_68px]";

  return (
    <section className="glass overflow-hidden rounded-2xl">
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
                className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 transition hover:border-primary/30 hover:text-primary"
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
        className={`hidden sm:grid ${gridCols} gap-3.5 bg-black/80 px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500`}
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
        className={`grid sm:hidden ${gridColsMobile} bg-black/80 px-3 py-2 text-xs uppercase tracking-wider text-gray-500`}
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
                  className={`hidden sm:grid ${gridCols} border-b border-white/5 px-3 py-2.5 gap-2 items-center`}
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
                  className={`grid sm:hidden ${gridColsMobile} border-b border-white/5 px-3 py-2.5 gap-2 items-center`}
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
                onClick={onClearSearch}
                className="mt-4 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
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
                  className={`block border-b border-white/5 transition ${
                    isMe
                      ? "bg-primary/15 hover:bg-primary/20"
                      : podium
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-white/5"
                  }`}
                >
                  {/* Desktop */}
                  <div className={`hidden md:grid ${gridCols} px-3 py-2.5 items-center gap-2`}>
                    <span
                      className={`font-mono text-xs ${podium ? "font-bold text-primary" : "text-gray-400"}`}
                    >
                      {String(rank).padStart(2, "0")}
                    </span>
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
                    <span
                      className={`font-mono text-xs ${podium ? "font-bold text-primary" : "text-gray-400"}`}
                    >
                      {String(rank).padStart(2, "0")}
                    </span>
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

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const dropdownHeight = Math.min(options.length * 36, 240);
      const spaceBelow = window.innerHeight - rect.bottom;
      const goUp = spaceBelow < dropdownHeight + 8;
      setPos({
        top: goUp ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 160),
      });
    }
    setOpen((o) => !o);
  };

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs transition hover:border-white/20"
      >
        <span className="uppercase tracking-wider text-gray-500">{label}</span>
        <span className="text-white">{selected?.label ?? "—"}</span>
        <ChevronDown size={12} className="text-gray-500 flex-shrink-0" />
      </button>

      {open &&
        typeof document !== "undefined" &&
        ReactDOM.createPortal(
          <div
            style={{
              position: "absolute",
              top: pos.top,
              left: pos.left,
              minWidth: pos.width,
              zIndex: 99999,
            }}
            className="rounded-md border border-white/10 bg-[#0f1117] shadow-xl"
          >
            <div className="max-h-60 overflow-y-auto">
              {options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center px-3 py-2 text-left text-xs transition hover:bg-white/10 ${
                    o.value === value ? "text-primary font-semibold" : "text-white"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

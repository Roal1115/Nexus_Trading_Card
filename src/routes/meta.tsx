import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ChevronDown, Loader2, Search, Shield, X } from "lucide-react";
import { useTCG } from "@/context/tcg.context";
import { useNexusRole } from "@/hooks/use-nexus-role";
import { myDashboardQuery } from "@/lib/dashboard-queries";
import { getMetaMatchups, getMetaStats } from "@/lib/nexus-meta.functions";
import { metaFilterOptionsQuery, metaQuery, type MetaFilters } from "@/lib/meta-queries";
import { SkeletonBlock } from "@/components/ui/skeleton-loader";
import { BlockSelect } from "@/components/ui/block-select";
import { shortLeaderName, setBadge } from "@/lib/leader-display";
import {
  BTN_OUTLINE,
  ChipGroup,
  FOCUS_RING,
  INPUT,
  InlineError,
  SECTION,
  plural,
} from "@/components/stores/store-ui";

const DEFAULT_GAME_ID = "5b608762-d0a3-4a93-9739-e5cd150b01cd";

type Period = "temporada" | "30d" | "90d" | "todo";
type MetaSearch = {
  zona?: string;
  tienda?: string;
  desde?: string;
  hasta?: string;
  /** Sin valor = temporada actual. Fechas propias (desde/hasta) mandan sobre el periodo. */
  periodo?: Exclude<Period, "temporada">;
  /** Columna de orden de la tabla; sin valor = uso. */
  orden?: SortKey;
  dir?: "asc";
};
// "30d" y no "30": un valor numérico se serializa como JSON en la URL (?periodo=%2230%22).
const PERIODS = ["30d", "90d", "todo"] as const;

type SortKey = "wr" | "1t" | "2t" | "partidas";
const SORT_KEYS: SortKey[] = ["wr", "1t", "2t", "partidas"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const Route = createFileRoute("/meta")({
  // Los filtros viven en la URL: "meta de Monterrey de los últimos 30 días" se comparte y
  // sobrevive atrás/adelante. Un valor inválido se ignora.
  validateSearch: (s: Record<string, unknown>): MetaSearch => ({
    zona: typeof s.zona === "string" && s.zona ? s.zona : undefined,
    tienda: typeof s.tienda === "string" && s.tienda ? s.tienda : undefined,
    desde: typeof s.desde === "string" && ISO_DATE.test(s.desde) ? s.desde : undefined,
    hasta: typeof s.hasta === "string" && ISO_DATE.test(s.hasta) ? s.hasta : undefined,
    periodo: PERIODS.find((p) => p === s.periodo),
    orden: SORT_KEYS.find((k) => k === s.orden),
    dir: s.dir === "asc" ? "asc" : undefined,
  }),
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
      // Solo las opciones: el meta por defecto depende de la temporada actual, que sale de
      // aquí mismo. Precargar "todo el historial" leía ~9,600 rondas para tirarlas.
      const options = await context.queryClient.ensureQueryData(
        metaFilterOptionsQuery(DEFAULT_GAME_ID),
      );
      return { options };
    } catch {
      return undefined;
    }
  },
  head: () => ({ meta: [{ title: "Meta — Nexus" }] }),
  component: MetaPage,
});

type MatchupData = Awaited<ReturnType<typeof getMetaMatchups>>;
type StatsLeader = Awaited<ReturnType<typeof getMetaStats>>["leaders"][number];

const COLOR_MAP: Record<string, { dot: string; name: string }> = {
  Red: { dot: "bg-red-500", name: "rojo" },
  Blue: { dot: "bg-blue-500", name: "azul" },
  Green: { dot: "bg-green-500", name: "verde" },
  Yellow: { dot: "bg-yellow-400", name: "amarillo" },
  Purple: { dot: "bg-purple-500", name: "morado" },
  Black: { dot: "bg-zinc-950 ring-1 ring-foreground-subtle", name: "negro" },
};

/** Colores de la carta: puntos visuales + el nombre para lectores de pantalla (no solo color). */
function ColorDots({ colors }: { colors: string[] }) {
  if (!colors.length) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {colors.map((c) => (
        <span
          key={c}
          aria-hidden="true"
          className={`h-2.5 w-2.5 rounded-full ${COLOR_MAP[c]?.dot ?? "bg-secondary"}`}
        />
      ))}
      <span className="sr-only">
        Colores: {colors.map((c) => COLOR_MAP[c]?.name ?? c).join(", ")}
      </span>
    </span>
  );
}

/** Código de set del leader ("ST29"): mono de 12px, chip neutro. */
function SetBadge({ code }: { code: string | null | undefined }) {
  const badge = setBadge(code);
  if (!badge) return null;
  return (
    <span className="flex-shrink-0 rounded border border-border px-1 font-mono text-xs text-foreground-secondary">
      {badge}
    </span>
  );
}

/**
 * Debajo de este número de rondas un porcentaje es ruido: 2 de 2 no es "100% favorable".
 * Se muestra neutro y marcado como muestra chica, y no encabeza los ordenamientos.
 */
const SMALL_SAMPLE = 8;
const isSmall = (n: number) => n < SMALL_SAMPLE;

/** Verde/rojo solo con muestra suficiente (Result Colors Rule + honestidad estadística). */
function wrTone(wr: number | null, n: number): string {
  if (wr === null) return "text-foreground-subtle";
  if (isSmall(n)) return "text-foreground-secondary";
  if (wr >= 55) return "text-success";
  if (wr < 45) return "text-danger";
  return "text-foreground";
}

/** Primero lo confiable, luego por WR: tres rondas de suerte no encabezan la lista. */
function byReliableWinRate(a: { cell: MetaCell }, b: { cell: MetaCell }): number {
  return (
    Number(!isSmall(b.cell.total)) - Number(!isSmall(a.cell.total)) ||
    b.cell.win_rate - a.cell.win_rate
  );
}

/** Fecha local de hoy menos n días, en ISO (aaaa-mm-dd). */
function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA");
}

/** "1 ago"; el año solo si no es el actual. */
function shortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

type Season = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

/**
 * Temporada actual: la activa que contiene hoy. Si conviven una mensual y una semestral, la
 * más larga, porque "la temporada" para el jugador es la que define el ranking del semestre.
 */
function currentSeason(seasons: Season[]): Season | null {
  const today = isoDaysAgo(0);
  const span = (x: Season) => Date.parse(x.end_date) - Date.parse(x.start_date);
  return (
    seasons
      .filter((x) => x.is_active && x.start_date <= today && today <= x.end_date)
      .sort((a, b) => span(b) - span(a))[0] ?? null
  );
}

/** Líderes visibles en ancho angosto antes de "Ver los N". */
const NARROW_TOP = 8;

/**
 * Lleva el foco (y la vista) al título del explorador: el botón que lo abrió desaparece o
 * queda lejos, y el lector de pantalla anuncia a qué líder se cambió.
 */
function focusExplorer() {
  requestAnimationFrame(() =>
    document.querySelector<HTMLElement>("[data-explorer-title]")?.focus(),
  );
}

function MetaPage() {
  const { activeTcg } = useTCG();
  const loaderData = Route.useLoaderData();

  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { player } = useNexusRole();

  // El juego lo fija el TCG activo; zona, tienda y fechas vienen de la URL y se aplican solos.
  const [gameId, setGameId] = useState(DEFAULT_GAME_ID);
  useEffect(() => {
    if (activeTcg?.id && activeTcg.id !== gameId) setGameId(activeTcg.id);
  }, [activeTcg?.id, gameId]);

  const optionsQuery = useQuery({
    ...metaFilterOptionsQuery(gameId),
    initialData: gameId === DEFAULT_GAME_ID ? loaderData?.options : undefined,
  });
  const season = currentSeason((optionsQuery.data?.seasons ?? []) as Season[]);

  // Periodo: fechas propias > periodo de la URL > temporada actual (si no hay, todo).
  const customDates = !!(search.desde || search.hasta);
  const period: Period = customDates ? "todo" : (search.periodo ?? (season ? "temporada" : "todo"));
  const range = customDates
    ? { from: search.desde ?? null, to: search.hasta ?? null }
    : period === "temporada" && season
      ? { from: season.start_date, to: season.end_date }
      : period === "30d" || period === "90d"
        ? { from: isoDaysAgo(parseInt(period, 10)), to: null }
        : { from: null, to: null };
  const periodLabel = customDates
    ? search.desde && search.hasta
      ? `${shortDate(search.desde)}–${shortDate(search.hasta)}`
      : search.desde
        ? `desde el ${shortDate(search.desde)}`
        : `hasta el ${shortDate(search.hasta!)}`
    : period === "temporada" && season
      ? `${season.name} (${shortDate(season.start_date)}–${shortDate(season.end_date)})`
      : period === "30d" || period === "90d"
        ? `últimos ${parseInt(period, 10)} días`
        : "todo el historial";

  const appliedFilters: MetaFilters = {
    game_id: gameId,
    zone: search.zona ?? null,
    store_id: search.tienda ?? null,
    date_from: range.from,
    date_to: range.to,
  };
  const filters = {
    ...appliedFilters,
    date_from: search.desde ?? null,
    date_to: search.hasta ?? null,
  };
  const setSearch = (patch: Partial<MetaSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  // La temporada sale de las opciones: sin ellas no se pide el meta, para no cargar
  // "todo el historial" y tirarlo un segundo después.
  const metaQ = useQuery({ ...metaQuery(appliedFilters), enabled: !!optionsQuery.data });
  const filterOptions = optionsQuery.data;
  // isPending (no isFetching): con keepPreviousData, cambiar zona o fechas no vuelve a
  // mostrar el esqueleto. Pero los datos de OTRO juego no se muestran nunca como si fueran
  // de este: mientras el TCG activo no coincide con lo cargado, es "cargando", no "sin datos".
  const loadedGameId = metaQ.data?.stats.filters.game_id;
  const loading =
    metaQ.isPending ||
    (!!activeTcg?.id && activeTcg.id !== appliedFilters.game_id) ||
    (!!loadedGameId && loadedGameId !== appliedFilters.game_id);
  const failed = metaQ.isError && !metaQ.data;
  // keepPreviousData deja los números del filtro anterior mientras llegan los nuevos (~8 s con
  // el meta completo). Sin aviso, "Zona Monterrey" mostraría cifras nacionales: se atenúan y
  // se dice que se están actualizando.
  const refreshing = !loading && metaQ.isFetching && metaQ.isPlaceholderData;
  const hasFilters = !!search.zona || !!search.tienda || customDates || !!search.periodo;

  const clearFilters = () => navigate({ search: {}, replace: true });

  // Con sesión, el explorador abre con el leader que más usa el jugador en este juego
  // (mismo cálculo y caché que el dashboard).
  const dashboardQ = useQuery({ ...myDashboardQuery(), enabled: !!player });
  const myLeaderId =
    (dashboardQ.data as { top3DecksByGame?: Record<string, Array<{ id: string }>> } | undefined)
      ?.top3DecksByGame?.[gameId]?.[0]?.id ?? null;

  const metaData = metaQ.data?.stats;
  const matchupData = metaQ.data?.matchups;
  const leaders = metaData?.leaders ?? [];

  // Orden de la tabla (la lista original, por uso, sigue alimentando al explorador). En
  // cualquier orden, un líder con muestra chica no encabeza: sus porcentajes aún son ruido.
  const sortKey = search.orden ?? "uso";
  const sortDir = search.dir === "asc" ? 1 : -1;
  const sortValue = (l: StatsLeader): [number, number | null] =>
    sortKey === "wr"
      ? [l.total_rounds, l.win_rate]
      : sortKey === "1t"
        ? [l.first_rounds, l.first_win_rate]
        : sortKey === "2t"
          ? [l.second_rounds, l.second_win_rate]
          : sortKey === "partidas"
            ? [Infinity, l.total_rounds]
            : [Infinity, l.play_rate];
  const sortedLeaders = [...leaders].sort((a, b) => {
    const [na, va] = sortValue(a);
    const [nb, vb] = sortValue(b);
    return (
      Number(!isSmall(nb)) - Number(!isSmall(na)) ||
      Number(vb != null) - Number(va != null) ||
      sortDir * ((va ?? 0) - (vb ?? 0))
    );
  });
  const setSort = (key: SortKey | "uso") =>
    setSearch(
      key === sortKey
        ? { dir: search.dir === "asc" ? undefined : "asc" }
        : { orden: key === "uso" ? undefined : key, dir: undefined },
    );
  const sortHeader = (key: SortKey | "uso", label: string, cls: string) => (
    <th
      scope="col"
      aria-sort={sortKey === key ? (sortDir === 1 ? "ascending" : "descending") : undefined}
      className={`hidden py-1 pr-2 text-right font-medium ${cls}`}
    >
      <button
        type="button"
        onClick={() => setSort(key)}
        className={`inline-flex min-h-9 items-center gap-1 rounded-md px-1 ${
          sortKey === key ? "text-foreground" : "text-foreground-subtle hover:text-foreground"
        } ${FOCUS_RING}`}
      >
        {label}
        {sortKey === key && (
          <ChevronDown size={14} aria-hidden="true" className={sortDir === 1 ? "rotate-180" : ""} />
        )}
      </button>
    </th>
  );

  // Click en una fila del leaderboard: perfil completo del líder — sus stats
  // agregados (ya vienen en la fila) + su fila de matchups contra TODOS los
  // líderes con datos, no solo el Top 10 de la matriz.
  // Un solo camino a los enfrentamientos de un líder: la fila del ranking y la búsqueda
  // abren el mismo explorador (antes la fila abría un panel aparte con la misma lista).
  const [exploringId, setExploringId] = useState<string | null>(null);
  const exploreLeader = (id: string) => {
    setExploringId(id);
    focusExplorer();
  };
  // En ancho angosto el ranking muestra 8 y el resto bajo "Ver los N": el explorador, que es
  // la herramienta para preparar mazo, queda ~1,300px más arriba en el teléfono.
  const [showAllLeaders, setShowAllLeaders] = useState(false);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pb-20 sm:px-6">
      <header className="mb-5">
        <h1 className="text-3xl font-bold text-foreground">Meta del circuito</h1>
        <p className="mt-1 max-w-[65ch] text-foreground-secondary">
          Qué se juega y qué gana, por líder, en los torneos oficiales publicados.
        </p>
      </header>

      {/* Filtros: zona a un toque; tienda y fechas plegadas. Se aplican solos y viven en la URL. */}
      <section aria-label="Filtrar el meta" className="mb-6 space-y-3">
        {(filterOptions?.zones ?? []).length > 1 && (
          <ChipGroup
            label="Filtrar por zona"
            value={filters.zone}
            onChange={(z) => setSearch({ zona: z ?? undefined, tienda: undefined })}
            options={[
              { key: null, label: "Todas las zonas" },
              ...(filterOptions?.zones ?? []).map((z: string) => ({ key: z, label: z })),
            ]}
          />
        )}
        <ChipGroup
          label="Periodo"
          value={customDates ? null : period}
          onChange={(k) =>
            k &&
            setSearch({
              periodo: k === "temporada" ? undefined : (k as MetaSearch["periodo"]),
              desde: undefined,
              hasta: undefined,
            })
          }
          options={[
            ...(season ? [{ key: "temporada", label: season.name }] : []),
            { key: "30d", label: "30 días" },
            { key: "90d", label: "90 días" },
            { key: "todo", label: "Todo" },
          ]}
        />
        <details
          className="group"
          open={!!(filters.store_id || filters.date_from || filters.date_to) || undefined}
        >
          <summary
            className={`inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md text-sm font-medium text-foreground-secondary hover:text-foreground sm:min-h-9 ${FOCUS_RING}`}
          >
            <ChevronDown
              size={16}
              aria-hidden="true"
              className="transition-transform group-open:rotate-180"
            />
            Tienda y fechas
          </summary>
          <div className="@container mt-2">
            <div className="grid gap-3 @lg:grid-cols-3">
              <div className="min-w-0 space-y-1.5">
                <label
                  htmlFor="meta-store"
                  className="text-sm font-medium text-foreground-secondary"
                >
                  Tienda
                </label>
                <BlockSelect
                  id="meta-store"
                  value={filters.store_id}
                  onChange={(v) => setSearch({ tienda: v ?? undefined })}
                  options={(filterOptions?.stores ?? [])
                    .filter((st: any) => !filters.zone || st.zone === filters.zone)
                    .map((st: any) => ({ value: st.id, label: st.name }))}
                  placeholder="Todas las tiendas"
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <label
                  htmlFor="meta-from"
                  className="text-sm font-medium text-foreground-secondary"
                >
                  Desde
                </label>
                <input
                  id="meta-from"
                  type="date"
                  value={filters.date_from ?? ""}
                  max={filters.date_to ?? undefined}
                  onChange={(e) => setSearch({ desde: e.target.value || undefined })}
                  style={{ colorScheme: "dark" }}
                  className={INPUT}
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <label htmlFor="meta-to" className="text-sm font-medium text-foreground-secondary">
                  Hasta
                </label>
                <input
                  id="meta-to"
                  type="date"
                  value={filters.date_to ?? ""}
                  min={filters.date_from ?? undefined}
                  onChange={(e) => setSearch({ hasta: e.target.value || undefined })}
                  style={{ colorScheme: "dark" }}
                  className={INPUT}
                />
              </div>
            </div>
          </div>
        </details>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className={`min-h-11 rounded-md px-1 text-sm font-medium text-foreground-secondary transition hover:text-foreground sm:min-h-9 ${FOCUS_RING}`}
          >
            Restablecer filtros
          </button>
        )}
      </section>

      {/* Líderes del meta: tabla real; en contenedor angosto las cifras pasan a 2.ª línea */}
      <section aria-labelledby="meta-leaders" className="@container">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="meta-leaders" className="text-lg font-semibold text-foreground">
            Líderes del meta
          </h2>
          {!loading && !failed && metaData && (
            <p role="status" className="font-mono-stat text-sm text-foreground-subtle">
              {refreshing ? (
                <span className="inline-flex items-center gap-1.5 text-foreground-secondary">
                  <Loader2 size={14} aria-hidden="true" className="animate-spin" />
                  Actualizando el meta · {periodLabel}
                </span>
              ) : (
                <>
                  {plural(leaders.length, "líder", "líderes")} ·{" "}
                  {metaData.total_rounds.toLocaleString("es-MX")}{" "}
                  {metaData.total_rounds === 1 ? "partida" : "partidas"} · {periodLabel}
                </>
              )}
            </p>
          )}
        </div>

        {metaQ.isError && metaQ.data && (
          <div className="mb-3">
            <InlineError onRetry={() => metaQ.refetch()}>
              No pudimos actualizar el meta; ves los datos anteriores.
            </InlineError>
          </div>
        )}

        {failed ? (
          <div className={SECTION}>
            <InlineError onRetry={() => metaQ.refetch()}>No pudimos cargar el meta.</InlineError>
          </div>
        ) : loading ? (
          <div className={`${SECTION} space-y-2`} aria-busy="true" aria-label="Cargando el meta">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonBlock key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : leaders.length === 0 ? (
          <div className={`${SECTION} space-y-3`}>
            <p className="text-foreground">
              {hasFilters
                ? "Ningún líder llega a 5 partidas con estos filtros."
                : "Todavía no hay líderes con 5 partidas en este periodo."}
            </p>
            <p className="text-sm text-foreground-secondary">
              {hasFilters
                ? "Prueba con otra zona, otra tienda o un periodo más amplio, o restablece los filtros."
                : "El meta se arma con los torneos oficiales publicados de este juego."}
            </p>
          </div>
        ) : (
          <>
            {/* Angosto: sin columnas numéricas no hay encabezados que ordenar */}
            <div className="mb-3 @2xl:hidden">
              <ChipGroup
                label="Ordenar líderes"
                value={sortKey === "1t" || sortKey === "2t" ? null : sortKey}
                onChange={(k) =>
                  k &&
                  setSearch({ orden: k === "uso" ? undefined : (k as SortKey), dir: undefined })
                }
                options={[
                  { key: "uso", label: "Más jugados" },
                  { key: "wr", label: "Mejor win rate" },
                  { key: "partidas", label: "Más partidas" },
                ]}
              />
            </div>
            <div
              aria-busy={refreshing || undefined}
              className={`overflow-hidden rounded-xl border border-border bg-card transition-opacity duration-200 ${refreshing ? "opacity-50" : ""}`}
            >
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Líderes con al menos 5 partidas. Ordena con los encabezados de columna; selecciona
                  un líder para ver sus enfrentamientos.
                </caption>
                <thead className="border-b border-border text-left text-xs text-foreground-subtle">
                  <tr>
                    <th scope="col" className="w-10 py-2 pl-4 font-medium">
                      #
                    </th>
                    <th scope="col" className="py-2 pr-2 font-medium">
                      Líder
                    </th>
                    {sortHeader("uso", "Uso", "@2xl:table-cell")}
                    {sortHeader("wr", "Win rate", "@2xl:table-cell")}
                    {sortHeader("1t", "1.er turno", "@3xl:table-cell")}
                    {sortHeader("2t", "2.º turno", "@3xl:table-cell")}
                    {sortHeader("partidas", "Partidas", "pr-4 @2xl:table-cell")}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedLeaders.map((leader, index) => (
                    <LeaderRow
                      key={leader.leader_id}
                      leader={leader}
                      rank={index + 1}
                      onOpen={() => exploreLeader(leader.leader_id)}
                      collapsed={!showAllLeaders && index >= NARROW_TOP}
                    />
                  ))}
                </tbody>
              </table>
              {!showAllLeaders && leaders.length > NARROW_TOP && (
                <div className="border-t border-border p-2 @2xl:hidden">
                  <button
                    type="button"
                    onClick={() => setShowAllLeaders(true)}
                    className={`${BTN_OUTLINE} w-full`}
                  >
                    Ver los {leaders.length} líderes
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {leaders.length > 0 && !loading && !failed && (
          <details className="group mt-3 text-sm text-foreground-secondary">
            <summary
              className={`inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md font-medium text-foreground-secondary hover:text-foreground sm:min-h-9 ${FOCUS_RING}`}
            >
              <ChevronDown
                size={16}
                aria-hidden="true"
                className="transition-transform group-open:rotate-180"
              />
              Cómo leer la tabla
            </summary>
            <dl className="mt-2 max-w-[65ch] space-y-2 pb-2">
              <div>
                <dt className="font-medium text-foreground">Uso</dt>
                <dd>Porcentaje de las partidas del periodo que se jugaron con ese líder.</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Win rate</dt>
                <dd>Partidas ganadas entre partidas jugadas con ese líder.</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">1.er y 2.º turno</dt>
                <dd>El win rate separado según si el líder jugó primero o segundo.</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Muestra</dt>
                <dd>
                  Una partida es una ronda de torneo. Solo aparecen líderes con 5 partidas o más, y
                  con menos de {SMALL_SAMPLE} el porcentaje va en gris, sin verde ni rojo: todavía
                  es ruido.
                </dd>
              </div>
            </dl>
          </details>
        )}

        <p className="mt-1 text-xs text-foreground-subtle">
          Datos de torneos oficiales publicados. Las partidas casuales no cuentan.
        </p>
      </section>

      {!loading && !failed && matchupData && matchupData.leaders.length >= 2 && (
        <div
          aria-busy={refreshing || undefined}
          className={`transition-opacity duration-200 ${refreshing ? "opacity-50" : ""}`}
        >
          <MatchupHeatmap
            data={matchupData}
            allLeaders={leaders}
            preferredLeaderId={myLeaderId}
            exploringId={exploringId}
            onExplore={(id) => (id ? exploreLeader(id) : setExploringId(null))}
          />
        </div>
      )}
    </main>
  );
}

/**
 * Una fila del ranking de líderes. El nombre es un botón estirado sobre la fila: toda la
 * fila abre el detalle, con teclado y con nombre accesible. En contenedor angosto las cifras
 * bajan a una segunda línea en vez de esconderse detrás de un scroll horizontal.
 */
function LeaderRow({
  leader,
  rank,
  onOpen,
  collapsed,
}: {
  leader: StatsLeader;
  rank: number;
  onOpen: () => void;
  /** Más allá del top en ancho angosto: oculta hasta "Ver los N" (en ancho, siempre visible). */
  collapsed?: boolean;
}) {
  const wr = (v: number | null, n: number) => <span className={wrTone(v, n)}>{pct(v)}</span>;
  return (
    <tr
      className={`relative align-top transition-colors hover:bg-white/5 ${collapsed ? "hidden @2xl:table-row" : ""}`}
    >
      <td className="py-3 pl-4 font-mono-stat text-foreground-secondary">{rank}</td>
      <td className="py-3 pr-2">
        <div className="flex items-start gap-3">
          {leader.leader_image ? (
            <img
              src={leader.leader_image}
              alt=""
              loading="lazy"
              className="h-10 w-7 flex-shrink-0 rounded border border-border object-cover"
            />
          ) : (
            <span className="flex h-10 w-7 flex-shrink-0 items-center justify-center rounded border border-border">
              <Shield size={14} aria-hidden="true" className="text-foreground-subtle" />
            </span>
          )}
          <div className="min-w-0">
            <button
              type="button"
              onClick={onOpen}
              className={`text-left font-semibold text-foreground after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-primary/50`}
            >
              {leader.leader_name}
            </button>
            <div className="mt-0.5 flex items-center gap-2">
              <SetBadge code={leader.card_set_id} />
              <ColorDots colors={leader.colors} />
            </div>
            {/* Contenedor angosto: las columnas numéricas viven aquí, no fuera de pantalla */}
            <p className="mt-1 font-mono-stat text-xs text-foreground-secondary @2xl:hidden">
              WR {wr(leader.win_rate, leader.total_rounds)} · uso {pct(leader.play_rate)} ·{" "}
              {leader.total_rounds} partidas
            </p>
            <p className="mt-0.5 font-mono-stat text-xs text-foreground-subtle @3xl:hidden">
              1.er turno {wr(leader.first_win_rate, leader.first_rounds)} · 2.º turno{" "}
              {wr(leader.second_win_rate, leader.second_rounds)}
            </p>
          </div>
        </div>
      </td>
      <td className="hidden py-3 pr-3 text-right font-mono-stat text-foreground @2xl:table-cell">
        {pct(leader.play_rate)}
      </td>
      <td className="hidden py-3 pr-3 text-right font-mono-stat font-semibold @2xl:table-cell">
        {wr(leader.win_rate, leader.total_rounds)}
      </td>
      <td className="hidden py-3 pr-3 text-right font-mono-stat @3xl:table-cell">
        {wr(leader.first_win_rate, leader.first_rounds)}
        <span className="block text-xs text-foreground-subtle">{leader.first_rounds} partidas</span>
      </td>
      <td className="hidden py-3 pr-3 text-right font-mono-stat @3xl:table-cell">
        {wr(leader.second_win_rate, leader.second_rounds)}
        <span className="block text-xs text-foreground-subtle">
          {leader.second_rounds} partidas
        </span>
      </td>
      <td className="hidden py-3 pr-4 text-right font-mono-stat text-foreground-secondary @2xl:table-cell">
        {leader.total_rounds}
      </td>
    </tr>
  );
}

/**
 * Fondo de la celda: verde/rojo según distancia al 50%, escalado por confianza (rondas).
 * Con muestra chica, neutro: 0% o 100% sobre 3 rondas no debe ser la celda más intensa.
 */
function heatColor(wr: number, n: number): string {
  if (isSmall(n)) return "rgba(255,255,255,0.04)";
  const dist = Math.abs(wr - 50) / 50;
  const confidence = Math.min(1, n / 20);
  const alpha = 0.08 + dist * 0.42 * confidence;
  return wr >= 50 ? `rgba(78,240,162,${alpha})` : `rgba(255,95,109,${alpha})`;
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

/**
 * Nombre para espacios chicos. Los líderes dobles ("Luffy & Ace", "Ace & Newgate") no se
 * abrevian: el apellido solo ("Ace") choca con otros líderes y cambia de identidad.
 */
const shortName = (name: string) => (name.includes("&") ? name : shortLeaderName(name));

/** Nombre corto + set: "Luffy ST29", para celdas y etiquetas accesibles. */
const leaderLabel = (l: MetaLeader) =>
  [shortName(l.leader_name), setBadge(l.card_set_id)].filter(Boolean).join(" ");

/**
 * Nombres sin espacios ("Eustass"Captain"Kid", "Monkey.D.Luffy") se partían a media palabra.
 * Un espacio de ancho cero tras comillas y puntos les da un corte natural. Solo para mostrar.
 */
const breakable = (name: string) => name.replace(/(["."'])(?=\S)/g, "$1\u200B");

/** Porcentaje con un decimal fijo, para que las columnas se alineen ("7.0%" junto a "7.2%"). */
const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);

/**
 * Un enfrentamiento como fila: carta del rival, nombre y set, y WR general con 1.er/2.º turno.
 * Reemplaza a las tarjetas de 237px: 15 rivales caben en dos pantallas, no en nueve.
 */
function MatchupRow({
  opp,
  cell,
  onClick,
}: {
  opp: MetaLeader;
  cell: MetaCell;
  onClick: () => void;
}) {
  const small = isSmall(cell.total);
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-label={`${opp.leader_name} ${setBadge(opp.card_set_id) ?? ""}: ${pct(cell.win_rate)} en ${cell.total} partidas${small ? ", muestra chica" : ""}`}
        className={`flex min-h-14 w-full items-center gap-3 py-2 text-left transition hover:bg-white/5 ${FOCUS_RING}`}
      >
        {opp.leader_image ? (
          <img
            src={opp.leader_image}
            alt=""
            loading="lazy"
            className="h-14 w-10 flex-shrink-0 rounded border border-border object-cover"
          />
        ) : (
          <span className="flex h-14 w-10 flex-shrink-0 items-center justify-center rounded border border-border">
            <Shield size={14} aria-hidden="true" className="text-foreground-subtle" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 break-words font-medium leading-snug text-foreground">
            {breakable(opp.leader_name)}
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <SetBadge code={opp.card_set_id} />
            <ColorDots colors={opp.colors ?? []} />
          </span>
        </span>
        <span className="flex-shrink-0 text-right font-mono-stat">
          <span className={`block text-base font-semibold ${wrTone(cell.win_rate, cell.total)}`}>
            {pct(cell.win_rate)}
          </span>
          <span className="block text-xs text-foreground-subtle">
            {cell.total} partidas{small ? " · muestra chica" : ""}
          </span>
          <span className="block text-xs text-foreground-secondary">
            1.er{" "}
            <span className={wrTone(cell.first_win_rate, cell.first_total)}>
              {pct(cell.first_win_rate)}
            </span>
            {" · "}2.º{" "}
            <span className={wrTone(cell.second_win_rate, cell.second_total)}>
              {pct(cell.second_win_rate)}
            </span>
          </span>
        </span>
      </button>
    </li>
  );
}

type MatchupItem = { opp: MetaLeader; cell: MetaCell };

/**
 * Lista de enfrentamientos de un líder con orden elegible. Para preparar un mazo importa más
 * "contra qué pierdo" que "contra qué gano", así que se puede ver primero lo peor. Ambos
 * órdenes ponen primero la muestra suficiente.
 */
function MatchupList({
  items,
  onSelect,
}: {
  items: MatchupItem[];
  onSelect: (item: MatchupItem) => void;
}) {
  const [order, setOrder] = useState<string | null>("best");
  const sorted = [...items].sort((a, b) =>
    order === "worst"
      ? Number(!isSmall(b.cell.total)) - Number(!isSmall(a.cell.total)) ||
        a.cell.win_rate - b.cell.win_rate
      : byReliableWinRate(a, b),
  );
  if (items.length === 0) {
    return (
      <p className="py-6 text-sm text-foreground-secondary">
        Todavía no hay enfrentamientos con 3 partidas o más para este líder.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <ChipGroup
        label="Ordenar enfrentamientos"
        value={order}
        onChange={(k) => k && setOrder(k)}
        options={[
          { key: "best", label: "Mejores primero" },
          { key: "worst", label: "Peores primero" },
        ]}
      />
      <ul className="divide-y divide-border">
        {sorted.map((item) => (
          <MatchupRow
            key={item.opp.leader_id}
            opp={item.opp}
            cell={item.cell}
            onClick={() => onSelect(item)}
          />
        ))}
      </ul>
    </div>
  );
}

function LeaderSearchResult({ l, onSelect }: { l: MetaLeader; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-h-11 w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-sm transition hover:bg-white/5 ${FOCUS_RING}`}
    >
      {l.leader_image ? (
        <img
          src={l.leader_image}
          alt=""
          className="h-9 w-6 flex-shrink-0 rounded border border-border object-cover"
        />
      ) : (
        <span className="flex h-9 w-6 flex-shrink-0 items-center justify-center rounded border border-border">
          <Shield size={12} aria-hidden="true" className="text-foreground-subtle" />
        </span>
      )}
      <span className="min-w-0 truncate text-foreground">{l.leader_name}</span>
      <SetBadge code={l.card_set_id} />
      <ColorDots colors={l.colors ?? []} />
    </button>
  );
}

/** Buscador de líderes con su lista y el estado "sin resultados" anunciado. */
function LeaderSearch({
  id,
  query,
  setQuery,
  results,
  onSelect,
}: {
  id: string;
  query: string;
  setQuery: (q: string) => void;
  results: MetaLeader[];
  onSelect: (l: MetaLeader) => void;
}) {
  return (
    <div className="relative">
      <label htmlFor={id} className="text-sm font-medium text-foreground-secondary">
        Ver los enfrentamientos de un líder
      </label>
      <div className="relative mt-1.5 max-w-md">
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle"
        />
        <input
          id={id}
          type="text"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nombre o set, ej. Luffy, ST29"
          className={`${INPUT} pl-9 pr-11`}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Borrar búsqueda"
            className={`absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-md text-foreground-subtle hover:text-foreground sm:h-9 ${FOCUS_RING}`}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      {query.trim() && (
        <div className="mt-1 max-w-md rounded-md border border-border bg-popover p-1 shadow-2xl">
          {results.length === 0 ? (
            <p role="status" className="px-3 py-2 text-sm text-foreground-secondary">
              Sin líderes para “{query.trim()}”.
            </p>
          ) : (
            results.map((l) => (
              <LeaderSearchResult key={l.leader_id} l={l} onSelect={() => onSelect(l)} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function MatchupHeatmap({
  data,
  allLeaders,
  preferredLeaderId,
  exploringId,
  onExplore,
}: {
  data: MatchupData;
  allLeaders: StatsLeader[];
  /** Leader más usado por el jugador con sesión: el explorador abre con él. */
  preferredLeaderId: string | null;
  /** Líder elegido (desde la tabla o la búsqueda); vive en la página para un solo camino. */
  exploringId: string | null;
  onExplore: (id: string | null) => void;
}) {
  const { leaders, matchups } = data;
  // Fijar un líder (fila o columna) resalta su fila y su columna y atenúa el resto, para no
  // sostener dos posiciones en la memoria al trazar el cruce.
  const [activeId, setActiveId] = useState<string | null>(null);
  const toggleActive = (id: string) => setActiveId((cur) => (cur === id ? null : id));

  const [selectedMatchup, setSelectedMatchup] = useState<{
    a: MetaLeader;
    b: MetaLeader;
    cell: MetaCell;
  } | null>(null);

  // Explorador: CUALQUIER líder elegible (no solo el Top 10 de la matriz). Los datos ya
  // están en `matchups`, así que es 100% del lado del cliente. Una sola búsqueda para
  // escritorio y móvil; en móvil el explorador es la vista principal.
  const [query, setQuery] = useState("");
  const exploringLeader = exploringId
    ? (allLeaders.find((l) => l.leader_id === exploringId) ?? null)
    : null;
  const results = query.trim()
    ? allLeaders
        .filter((l) => leaderMatches(l, query))
        .sort(bySetBadgeDesc)
        .slice(0, 8)
    : [];
  // En contenedor angosto no hay matriz: se explora el leader del jugador (si tiene sesión y
  // un leader con datos) o el más jugado.
  const myLeader = preferredLeaderId
    ? (allLeaders.find((l) => l.leader_id === preferredLeaderId) ?? null)
    : null;
  // El líder que muestra el explorador: el elegido, o por defecto el del jugador o el más jugado.
  const currentLeader = exploringLeader ?? myLeader ?? allLeaders[0] ?? null;

  const matchupRow = (leaderId: string) =>
    allLeaders
      .filter((l) => l.leader_id !== leaderId)
      .map((opp) => ({ opp, cell: matchups[`${leaderId}|${opp.leader_id}`] }))
      .filter((r): r is { opp: StatsLeader; cell: MetaCell } => Boolean(r.cell));

  const explorer = (leader: StatsLeader) => {
    const row = matchupRow(leader.leader_id);
    return (
      <div>
        <div className="flex items-center gap-3 border-b border-border pb-3">
          {leader.leader_image && (
            <img
              src={leader.leader_image}
              alt=""
              className="h-14 w-10 flex-shrink-0 rounded-md border border-border object-cover"
            />
          )}
          <div className="min-w-0">
            <h3
              data-explorer-title
              tabIndex={-1}
              className="font-semibold text-foreground outline-none"
            >
              Enfrentamientos de {leader.leader_name}
              {leader.leader_id === preferredLeaderId && (
                <span className="ml-2 text-sm font-normal text-foreground-subtle">· tu leader</span>
              )}
            </h3>
            <div className="mt-0.5 flex items-center gap-2">
              <SetBadge code={leader.card_set_id} />
              <ColorDots colors={leader.colors ?? []} />
            </div>
          </div>
        </div>
        {/* Las cifras del líder, antes solo en el panel de la fila */}
        <dl className="flex flex-wrap gap-x-6 gap-y-3 border-b border-border py-3">
          <Stat label="Win rate" sub={`${leader.total_rounds} partidas`}>
            <span className={wrTone(leader.win_rate, leader.total_rounds)}>
              {pct(leader.win_rate)}
            </span>
          </Stat>
          <Stat label="1.er turno" sub={`${leader.first_rounds} partidas`}>
            <span className={wrTone(leader.first_win_rate, leader.first_rounds)}>
              {pct(leader.first_win_rate)}
            </span>
          </Stat>
          <Stat label="2.º turno" sub={`${leader.second_rounds} partidas`}>
            <span className={wrTone(leader.second_win_rate, leader.second_rounds)}>
              {pct(leader.second_win_rate)}
            </span>
          </Stat>
          <Stat label="Uso">
            <span className="text-foreground">{pct(leader.play_rate)}</span>
          </Stat>
          {leader.tournaments_won > 0 && (
            <Stat label="Torneos ganados">
              <span className="text-foreground">{leader.tournaments_won}</span>
            </Stat>
          )}
        </dl>
        <div className="mt-2">
          <MatchupList
            items={row}
            onSelect={({ opp, cell }) => setSelectedMatchup({ a: leader, b: opp, cell })}
          />
        </div>
      </div>
    );
  };

  const dim = (ids: string[]) => (activeId && !ids.includes(activeId) ? "opacity-35" : "");

  return (
    <section aria-labelledby="meta-matchups" className="@container mt-10">
      <header className="mb-4">
        <h2 id="meta-matchups" className="text-lg font-semibold text-foreground">
          Enfrentamientos
        </h2>
        <p className="mt-1 max-w-[65ch] text-sm text-foreground-secondary">
          <span className="hidden @4xl:inline">
            Win rate del líder de la fila contra el de la columna, entre los 10 más jugados.{" "}
          </span>
          <span className="@4xl:hidden">Elige un líder para ver contra quién gana y pierde. </span>
          Cada cruce necesita al menos 3 partidas.
        </p>
      </header>

      <div className={`${SECTION} space-y-4`}>
        <LeaderSearch
          id="meta-explore"
          query={query}
          setQuery={setQuery}
          results={results}
          onSelect={(l) => {
            setQuery("");
            onExplore(l.leader_id);
          }}
        />

        {/* Ancho sin líder elegido: la matriz. Elegir un líder la reemplaza por el explorador. */}
        <div className={exploringLeader ? "hidden" : "hidden @4xl:block"}>
          {
            <>
              <table className="w-full table-fixed border-separate border-spacing-1">
                <caption className="sr-only">
                  Win rate de cada líder de la fila contra cada líder de la columna.
                </caption>
                <thead>
                  <tr>
                    <td className="w-32" />
                    {leaders.map((l) => (
                      <th
                        key={l.leader_id}
                        scope="col"
                        className={`align-bottom transition-opacity ${dim([l.leader_id])}`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleActive(l.leader_id)}
                          aria-pressed={activeId === l.leader_id}
                          aria-label={`Resaltar ${leaderLabel(l)}`}
                          title={l.leader_name}
                          className={`flex w-full flex-col items-center gap-1 rounded-md p-1 text-xs font-medium ${
                            activeId === l.leader_id
                              ? "text-foreground"
                              : "text-foreground-secondary"
                          } hover:text-foreground ${FOCUS_RING}`}
                        >
                          {l.leader_image ? (
                            <img
                              src={l.leader_image}
                              alt=""
                              className="h-12 w-9 rounded border border-border object-cover"
                            />
                          ) : null}
                          <span className="w-full truncate">{shortName(l.leader_name)}</span>
                          <SetBadge code={l.card_set_id} />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaders.map((row) => (
                    <tr key={row.leader_id}>
                      <th
                        scope="row"
                        className={`text-right transition-opacity ${dim([row.leader_id])}`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleActive(row.leader_id)}
                          aria-pressed={activeId === row.leader_id}
                          aria-label={`Resaltar ${leaderLabel(row)}`}
                          title={row.leader_name}
                          className={`ml-auto flex max-w-full flex-col items-end rounded-md px-1 py-0.5 text-sm font-semibold ${
                            activeId === row.leader_id
                              ? "text-foreground"
                              : "text-foreground-secondary"
                          } hover:text-foreground ${FOCUS_RING}`}
                        >
                          <span className="max-w-full truncate">{shortName(row.leader_name)}</span>
                          <SetBadge code={row.card_set_id} />
                        </button>
                      </th>
                      {leaders.map((col) => {
                        const fade = dim([row.leader_id, col.leader_id]);
                        if (row.leader_id === col.leader_id) {
                          return (
                            <td
                              key={col.leader_id}
                              className={`h-14 rounded-md bg-white/[0.03] text-center text-foreground-subtle ${fade}`}
                            >
                              <span aria-label="Mismo líder">—</span>
                            </td>
                          );
                        }
                        const cell = matchups[`${row.leader_id}|${col.leader_id}`];
                        if (!cell) {
                          return (
                            <td
                              key={col.leader_id}
                              className={`h-14 rounded-md text-center text-xs text-foreground-subtle ${fade}`}
                            >
                              <span className="sr-only">
                                {leaderLabel(row)} contra {leaderLabel(col)}: menos de 3 partidas
                              </span>
                              <span aria-hidden="true">·</span>
                            </td>
                          );
                        }
                        const small = isSmall(cell.total);
                        return (
                          <td key={col.leader_id} className={`h-14 p-0 transition-opacity ${fade}`}>
                            <button
                              type="button"
                              onClick={() => setSelectedMatchup({ a: row, b: col, cell })}
                              aria-label={`${leaderLabel(row)} contra ${leaderLabel(col)}: ${pct(cell.win_rate)}, ${cell.wins}–${cell.total - cell.wins} en ${cell.total} partidas${small ? ", muestra chica" : ""}`}
                              style={{ backgroundColor: heatColor(cell.win_rate, cell.total) }}
                              className={`flex h-full w-full flex-col items-center justify-center rounded-md hover:ring-1 hover:ring-foreground-subtle ${FOCUS_RING}`}
                            >
                              <span
                                className={`font-mono-stat text-sm font-semibold ${small ? "text-foreground-secondary" : "text-foreground"}`}
                              >
                                {pct(cell.win_rate)}
                              </span>
                              {/* Sobre el tinte, texto principal: el secundario bajaba a 4:1 */}
                              <span
                                className={`font-mono-stat text-xs ${small ? "text-foreground-subtle" : "text-foreground"}`}
                              >
                                {cell.total}
                              </span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-foreground-secondary">
                <li className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: heatColor(80, 40) }}
                  />
                  Favorable para la fila
                </li>
                <li className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: heatColor(20, 40) }}
                  />
                  Desfavorable
                </li>
                <li className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 rounded-sm border border-border"
                    style={{ backgroundColor: heatColor(50, 1) }}
                  />
                  Menos de {SMALL_SAMPLE} partidas: muestra chica
                </li>
                <li>
                  El número bajo el porcentaje son las partidas. Selecciona un líder para resaltar
                  su fila y columna, o una celda para el detalle.
                </li>
              </ul>
            </>
          }
        </div>

        {/* El explorador se monta una sola vez: siempre en angosto; en ancho, solo con un líder
            elegido (si no, se ve la matriz). */}
        {currentLeader && (
          <div className={exploringLeader ? "space-y-3" : "@4xl:hidden"}>
            {exploringLeader && (
              // Envuelto: BTN_OUTLINE trae inline-flex, que le gana a "hidden" en el mismo botón.
              <div className="hidden @4xl:block">
                <button type="button" onClick={() => onExplore(null)} className={BTN_OUTLINE}>
                  <ArrowLeft size={16} aria-hidden="true" />
                  Volver a la matriz
                </button>
              </div>
            )}
            {explorer(currentLeader)}
          </div>
        )}
      </div>

      {selectedMatchup && (
        <MatchupDrawer
          a={selectedMatchup.a}
          b={selectedMatchup.b}
          cell={selectedMatchup.cell}
          onClose={() => setSelectedMatchup(null)}
        />
      )}
    </section>
  );
}

/**
 * Panel lateral del meta sobre Radix Dialog: se monta en document.body (The Portal Rule),
 * atrapa y devuelve el foco, bloquea el scroll de fondo y, con paneles anidados, Escape
 * cierra solo el de arriba. Superficie popover sólida, sin desenfoque.
 */
function MetaSheet({
  title,
  header,
  onClose,
  wide,
  children,
}: {
  title: string;
  header: ReactNode;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  // Se abre desde una fila o celda, no desde un Dialog.Trigger: Radix no sabría a quién
  // devolver el foco. Se guarda quién lo tenía al abrir y se le devuelve al cerrar.
  const [returnTo] = useState(() =>
    typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null,
  );
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/70 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            returnTo?.focus();
          }}
          className={`fixed inset-y-0 right-0 z-[71] flex w-full ${wide ? "max-w-xl" : "max-w-md"} flex-col border-l border-border bg-popover shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=open]:duration-200`}
        >
          <div className="flex flex-shrink-0 items-center gap-3 border-b border-border py-2 pl-4 pr-2">
            <div className="min-w-0 flex-1">{header}</div>
            <Dialog.Title className="sr-only">{title}</Dialog.Title>
            <Dialog.Close
              aria-label="Cerrar"
              className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-foreground-secondary transition hover:bg-white/5 hover:text-foreground ${FOCUS_RING}`}
            >
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Carta + nombre + set + colores, para el encabezado de un enfrentamiento. */
function LeaderIdentity({ leader }: { leader: MetaLeader }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
      {leader.leader_image ? (
        <img
          src={leader.leader_image}
          alt=""
          className="h-24 w-16 rounded-md border border-border object-cover"
        />
      ) : (
        <span className="flex h-24 w-16 items-center justify-center rounded-md border border-border">
          <Shield size={18} aria-hidden="true" className="text-foreground-subtle" />
        </span>
      )}
      <span className="text-balance text-sm font-semibold leading-snug text-foreground">
        {breakable(leader.leader_name)}
      </span>
      <span className="flex items-center gap-2">
        <SetBadge code={leader.card_set_id} />
        <ColorDots colors={leader.colors ?? []} />
      </span>
    </div>
  );
}

/** Fila de datos (Stat Row): label de 12px sobre la cifra en mono, sin cajas. */
function Stat({ label, children, sub }: { label: string; children: ReactNode; sub?: string }) {
  return (
    <div>
      <dt className="text-xs text-foreground-subtle">{label}</dt>
      <dd className="mt-0.5 font-mono-stat text-lg font-semibold">{children}</dd>
      {sub && <dd className="font-mono-stat text-xs text-foreground-subtle">{sub}</dd>}
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
  const rows: Array<{
    label: string;
    wr: number | null;
    total: number;
    record?: { wins: number; total: number };
  }> = [
    { label: "En total", wr: cell.win_rate, total: cell.total, record: cell },
    { label: "1.er turno", wr: cell.first_win_rate, total: cell.first_total },
    { label: "2.º turno", wr: cell.second_win_rate, total: cell.second_total },
  ];
  return (
    <MetaSheet
      title={`${a.leader_name} contra ${b.leader_name}`}
      onClose={onClose}
      header={<p className="font-semibold text-foreground">Enfrentamiento</p>}
    >
      <div className="flex items-start justify-center gap-3">
        <LeaderIdentity leader={a} />
        <span className="mt-10 flex-shrink-0 text-sm text-foreground-subtle">contra</span>
        <LeaderIdentity leader={b} />
      </div>

      <p className="mt-5 text-sm text-foreground-secondary">
        Win rate de {leaderLabel(a)} contra {leaderLabel(b)}
        {a.leader_id !== b.leader_id ? "" : " (mismo líder)"}:
      </p>
      <dl className="mt-2 divide-y divide-border border-y border-border">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 py-3">
            <dt className="text-sm text-foreground-secondary">{r.label}</dt>
            <dd className="text-right font-mono-stat">
              <span className={`text-lg font-semibold ${wrTone(r.wr, r.total)}`}>{pct(r.wr)}</span>
              <span className="block text-xs text-foreground-subtle">
                {r.record && (
                  <span className="text-foreground-secondary">
                    {r.record.wins}V–{r.record.total - r.record.wins}D ·{" "}
                  </span>
                )}
                {r.total} partidas{isSmall(r.total) && r.total > 0 ? " · muestra chica" : ""}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-foreground-subtle">
        Cada cruce necesita 3 partidas o más. Con menos de {SMALL_SAMPLE} el porcentaje va en gris.
      </p>
    </MetaSheet>
  );
}
